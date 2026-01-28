import type { ExampleData } from "./core/data.js";
import { FormatHandler } from "./formatHandler.js";

export interface PromptTemplateStructured {
  description: string;
  examples?: ExampleData[];
}

export class QAPromptGenerator {
  template: PromptTemplateStructured;
  formatHandler: FormatHandler;
  examplesHeading = "Examples";
  questionPrefix = "Q: ";
  answerPrefix = "A: ";

  constructor(template: PromptTemplateStructured, formatHandler: FormatHandler) {
    this.template = template;
    this.formatHandler = formatHandler;
  }

  toString(): string {
    return this.render("");
  }

  formatExampleAsText(example: ExampleData): string {
    const question = example.text;
    const answer = this.formatHandler.formatExtractionExample(
      example.extractions.map((ex: ExampleData["extractions"][number]) => ({
        extractionClass: ex.extractionClass,
        extractionText: ex.extractionText,
        attributes: ex.attributes ?? null,
      }))
    );
    return [
      `${this.questionPrefix}${question}`,
      `${this.answerPrefix}${answer}\n`,
    ].join("\n");
  }

  render(question: string, additionalContext?: string | null): string {
    const promptLines: string[] = [`${this.template.description}\n`];

    if (additionalContext) {
      promptLines.push(`${additionalContext}\n`);
    }

    if (this.template.examples && this.template.examples.length > 0) {
      promptLines.push(this.examplesHeading);
      for (const ex of this.template.examples) {
        promptLines.push(this.formatExampleAsText(ex));
      }
    }

    promptLines.push(`${this.questionPrefix}${question}`);
    promptLines.push(this.answerPrefix);
    return promptLines.join("\n");
  }
}

export class PromptBuilder {
  protected generator: QAPromptGenerator;

  constructor(generator: QAPromptGenerator) {
    this.generator = generator;
  }

  buildPrompt(chunkText: string, _documentId: string, additionalContext?: string | null): string {
    return this.generator.render(chunkText, additionalContext);
  }
}

export class ContextAwarePromptBuilder extends PromptBuilder {
  private contextWindowChars: number | null;
  private prevChunkByDocId: Map<string, string> = new Map();
  private static readonly CONTEXT_PREFIX = "[Previous text]: ...";

  constructor(generator: QAPromptGenerator, contextWindowChars: number | null = null) {
    super(generator);
    this.contextWindowChars = contextWindowChars;
  }

  override buildPrompt(chunkText: string, documentId: string, additionalContext?: string | null): string {
    const effectiveContext = this.buildEffectiveContext(documentId, additionalContext ?? null);
    const prompt = this.generator.render(chunkText, effectiveContext ?? undefined);
    this.updateState(documentId, chunkText);
    return prompt;
  }

  private buildEffectiveContext(documentId: string, additionalContext?: string | null): string | null {
    const parts: string[] = [];
    if (this.contextWindowChars && this.prevChunkByDocId.has(documentId)) {
      const prevText = this.prevChunkByDocId.get(documentId) ?? "";
      const window = prevText.slice(-this.contextWindowChars);
      parts.push(`${ContextAwarePromptBuilder.CONTEXT_PREFIX}${window}`);
    }

    if (additionalContext) {
      parts.push(additionalContext);
    }

    return parts.length ? parts.join("\n\n") : null;
  }

  private updateState(documentId: string, chunkText: string) {
    if (this.contextWindowChars) {
      this.prevChunkByDocId.set(documentId, chunkText);
    }
  }
}
