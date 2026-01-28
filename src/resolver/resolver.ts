import type { Extraction } from "../core/data.js";
import { ResolverParsingError } from "../core/errors.js";
import { FormatHandler } from "../formatHandler.js";
import { WordAligner } from "./wordAligner.js";
import type { Tokenizer } from "../core/tokenizer/index.js";

const DEFAULT_INDEX_SUFFIX = "_index";

export interface ResolverOptions {
  formatHandler?: FormatHandler;
  extractionIndexSuffix?: string | null;
}

export interface AlignParams {
  enableFuzzyAlignment?: boolean;
  fuzzyAlignmentThreshold?: number;
  acceptMatchLesser?: boolean;
  tokenizerInst?: Tokenizer | null;
}

export class Resolver {
  formatHandler: FormatHandler;
  extractionIndexSuffix?: string | null;

  constructor(opts: ResolverOptions = {}) {
    this.formatHandler = opts.formatHandler ?? new FormatHandler();
    this.extractionIndexSuffix = opts.extractionIndexSuffix ?? null;
  }

  resolve(inputText: string, opts?: { suppressParseErrors?: boolean }): Extraction[] {
    try {
      const extractionData = this.formatHandler.parseOutput(inputText, false);
      return this.extractOrderedExtractions(extractionData);
    } catch (err) {
      if (opts?.suppressParseErrors) {
        return [];
      }
      throw new ResolverParsingError(String(err));
    }
  }

  align(
    extractions: Extraction[],
    sourceText: string,
    tokenOffset: number,
    charOffset: number | null,
    params: AlignParams = {}
  ): Extraction[] {
    if (!extractions.length) return [];
    const aligner = new WordAligner();
    const groups = aligner.alignExtractions([extractions], sourceText, {
      tokenOffset,
      charOffset: charOffset ?? 0,
      enableFuzzyAlignment: params.enableFuzzyAlignment,
      fuzzyAlignmentThreshold: params.fuzzyAlignmentThreshold,
      acceptMatchLesser: params.acceptMatchLesser,
      tokenizerImpl: params.tokenizerInst ?? null,
    });
    return groups.flat();
  }

  private extractOrderedExtractions(
    extractionData: Array<Record<string, unknown>>
  ): Extraction[] {
    const processed: Extraction[] = [];
    let extractionIndex = 0;
    const indexSuffix = this.extractionIndexSuffix;
    const attributesSuffix = this.formatHandler.attributeSuffix;

    extractionData.forEach((group, groupIndex) => {
      for (const [key, value] of Object.entries(group)) {
        if (indexSuffix && key.endsWith(indexSuffix)) {
          if (typeof value !== "number" || !Number.isInteger(value)) {
            throw new Error("Index must be an integer.");
          }
          continue;
        }

        if (attributesSuffix && key.endsWith(attributesSuffix)) {
          if (value !== null && typeof value !== "object") {
            throw new Error("Extraction value must be a dict or None for attributes.");
          }
          continue;
        }

        if (typeof value !== "string" && typeof value !== "number") {
          throw new Error("Extraction text must be a string, integer, or float.");
        }

        const extractionText = typeof value === "string" ? value : String(value);

        if (indexSuffix) {
          const indexKey = `${key}${indexSuffix}`;
          const idx = group[indexKey];
          if (idx == null) {
            continue;
          }
          if (typeof idx !== "number" || !Number.isInteger(idx)) {
            throw new Error("Index must be an integer.");
          }
          extractionIndex = idx;
        } else {
          extractionIndex += 1;
        }

        let attributes: Record<string, unknown> | null = null;
        if (attributesSuffix) {
          const attributesKey = `${key}${attributesSuffix}`;
          const attrs = group[attributesKey];
          if (attrs && typeof attrs === "object") {
            attributes = attrs as Record<string, unknown>;
          } else if (attrs === null) {
            attributes = null;
          }
        }

        processed.push({
          extractionClass: key,
          extractionText,
          extractionIndex,
          groupIndex,
          attributes: attributes as any,
        });
      }
    });

    processed.sort((a, b) => (a.extractionIndex ?? 0) - (b.extractionIndex ?? 0));
    return processed;
  }
}

export { DEFAULT_INDEX_SUFFIX };
