import pLimit from "p-limit";
import type { AnnotatedDocument, ExampleData, Extraction } from "./core/data.js";
import { createDocument } from "./core/data.js";
import type { Tokenizer, TokenizedText } from "./core/tokenizer/index.js";
import { RegexTokenizer, UnicodeTokenizer } from "./core/tokenizer/index.js";
import { ChunkIterator, makeBatchesOfTextChunk } from "./chunking.js";
import { FormatHandler } from "./formatHandler.js";
import { QAPromptGenerator, ContextAwarePromptBuilder } from "./prompting.js";
import { buildExtractionJsonSchemaFromExamples } from "./schemaBuilder.js";
import { Resolver } from "./resolver/index.js";
import type { LanguageModel } from "./providers/baseModel.js";

export interface ExtractOptions {
  additionalContext?: string;

  tokenizer?: "unicode" | "regex" | Tokenizer;
  maxCharBuffer?: number;

  enableFuzzyAlignment?: boolean;
  fuzzyAlignmentThreshold?: number;
  acceptMatchLesser?: boolean;

  attributeSuffix?: string;
  useStructuredOutput?: boolean;

  passes?: number;
  contextWindowChars?: number | null;

  concurrency?: {
    maxConcurrency?: number;
    batchSize?: number;
  };

  debug?: boolean;
}

export interface ExtractInput {
  text: string;
  promptDescription: string;
  examples: ExampleData[];
  model: LanguageModel;
  options?: ExtractOptions;
}

function pickTokenizer(tokenizer: ExtractOptions["tokenizer"]): Tokenizer {
  if (!tokenizer || tokenizer === "regex") return new RegexTokenizer();
  if (tokenizer === "unicode") return new UnicodeTokenizer();
  return tokenizer;
}

function mergeNonOverlapping(allPasses: Extraction[][]): Extraction[] {
  if (!allPasses.length) return [];
  const merged = [...(allPasses[0] ?? [])];

  for (const pass of allPasses.slice(1)) {
    for (const extraction of pass) {
      let overlaps = false;
      if (extraction.charInterval) {
        for (const existing of merged) {
          if (existing.charInterval) {
            const a = extraction.charInterval;
            const b = existing.charInterval;
            if (a.startPos < b.endPos && b.startPos < a.endPos) {
              overlaps = true;
              break;
            }
          }
        }
      }
      if (!overlaps) merged.push(extraction);
    }
  }

  return merged;
}

export async function extract(input: ExtractInput): Promise<AnnotatedDocument> {
  const { text, promptDescription, examples, model } = input;
  const opts = input.options ?? {};

  if (!examples || examples.length === 0) {
    throw new Error("Examples are required for reliable extraction.");
  }

  const tokenizer = pickTokenizer(opts.tokenizer);
  const maxCharBuffer = opts.maxCharBuffer ?? 200;
  const passes = opts.passes ?? 1;
  const batchSize = opts.concurrency?.batchSize ?? 1;
  const maxConcurrency = opts.concurrency?.maxConcurrency ?? 4;

  const formatHandler = new FormatHandler({
    useFences: false,
    attributeSuffix: opts.attributeSuffix,
  });
  const resolver = new Resolver({ formatHandler });

  const schema = buildExtractionJsonSchemaFromExamples(examples, opts.attributeSuffix);
  const promptTemplate = {
    description: promptDescription,
    examples,
  };

  const doc = createDocument(text, { additionalContext: opts.additionalContext ?? null });
  doc.tokenizedText = tokenizer.tokenize(doc.text);

  const limit = pLimit(maxConcurrency);

  const passExtractions: Extraction[][] = [];

  for (let pass = 0; pass < passes; pass += 1) {
    const passResults: Extraction[] = [];
    const promptGenerator = new QAPromptGenerator(promptTemplate, formatHandler);
    const promptBuilder = new ContextAwarePromptBuilder(
      promptGenerator,
      opts.contextWindowChars ?? null
    );
    const chunkIter = new ChunkIterator(
      doc.tokenizedText as TokenizedText,
      maxCharBuffer,
      tokenizer,
      doc
    );
    const batches = makeBatchesOfTextChunk(chunkIter, batchSize);
    const batchTasks: Array<Promise<void>> = [];

    for (const batch of batches) {
      const prompts = batch.map((chunk) =>
        promptBuilder.buildPrompt(chunk.chunkText, chunk.documentId ?? "doc", chunk.additionalContext)
      );
      batchTasks.push(
        limit(async () => {
          const outputs = await model.generateJson<Record<string, unknown>>(prompts, schema);

          outputs.forEach((output: Record<string, unknown>, idx: number) => {
            const chunk = batch[idx]!;
            const resolved = resolver.resolve(JSON.stringify(output));
            const aligned = resolver.align(
              resolved,
              chunk.chunkText,
              chunk.tokenInterval.startIndex,
              chunk.charInterval.startPos,
              {
                enableFuzzyAlignment: opts.enableFuzzyAlignment,
                fuzzyAlignmentThreshold: opts.fuzzyAlignmentThreshold,
                acceptMatchLesser: opts.acceptMatchLesser,
                tokenizerInst: tokenizer,
              }
            );
            passResults.push(...aligned);
          });
        })
      );
    }

    await Promise.all(batchTasks);
    passExtractions.push(passResults);
  }

  const merged = mergeNonOverlapping(passExtractions);
  return {
    documentId: doc.documentId,
    text: doc.text,
    extractions: merged,
  };
}
