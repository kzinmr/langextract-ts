import type { Extraction, CharInterval, TokenInterval } from "../core/data.js";
import type { TokenizedText, Tokenizer } from "../core/tokenizer/index.js";
import { tokenize } from "../core/tokenizer/index.js";
import { SequenceMatcher } from "./sequenceMatcher.js";

export interface AlignOptions {
  tokenOffset?: number;
  charOffset?: number;
  delim?: string;
  enableFuzzyAlignment?: boolean;
  fuzzyAlignmentThreshold?: number;
  acceptMatchLesser?: boolean;
  tokenizerImpl?: Tokenizer | null;
}

const FUZZY_ALIGNMENT_MIN_THRESHOLD = 0.75;

function tokenizeWithLowercase(text: string, tokenizerImpl?: Tokenizer | null): string[] {
  const tokenized = tokenizerImpl ? tokenizerImpl.tokenize(text) : tokenize(text);
  const originalText = tokenized.text;
  return tokenized.tokens.map((token) =>
    originalText.slice(token.charInterval.startPos, token.charInterval.endPos).toLowerCase()
  );
}

const normalizeCache = new Map<string, string>();
function normalizeToken(token: string): string {
  const cached = normalizeCache.get(token);
  if (cached) return cached;
  let t = token.toLowerCase();
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) {
    t = t.slice(0, -1);
  }
  normalizeCache.set(token, t);
  return t;
}

function counter(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) {
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return m;
}

function intersectionTotal(a: Map<string, number>, b: Map<string, number>): number {
  let total = 0;
  for (const [key, aCount] of a.entries()) {
    const bCount = b.get(key);
    if (bCount) {
      total += Math.min(aCount, bCount);
    }
  }
  return total;
}

export class WordAligner {
  alignExtractions(
    extractionGroups: Extraction[][],
    sourceText: string,
    options: AlignOptions = {}
  ): Extraction[][] {
    if (!extractionGroups.length) return [];

    const tokenOffset = options.tokenOffset ?? 0;
    const charOffset = options.charOffset ?? 0;
    const delim = options.delim ?? "\u241F";
    const enableFuzzy = options.enableFuzzyAlignment ?? true;
    const threshold = options.fuzzyAlignmentThreshold ?? FUZZY_ALIGNMENT_MIN_THRESHOLD;
    const acceptMatchLesser = options.acceptMatchLesser ?? true;
    const tokenizerImpl = options.tokenizerImpl ?? null;

    const sourceTokens = tokenizeWithLowercase(sourceText, tokenizerImpl);
    const delimLen = tokenizeWithLowercase(delim, tokenizerImpl).length;
    if (delimLen !== 1) {
      throw new Error(`Delimiter ${delim} must be a single token.`);
    }

    const extractionTokens = tokenizeWithLowercase(
      extractionGroups.flat().map((e) => e.extractionText).join(` ${delim} `),
      tokenizerImpl
    );

    const matcher = new SequenceMatcher();
    matcher.setSeqs(sourceTokens, extractionTokens);

    const indexToExtraction: Map<number, { extraction: Extraction; groupIndex: number }> = new Map();
    let extractionIndex = 0;

    extractionGroups.forEach((group, groupIndex) => {
      group.forEach((extraction) => {
        if (extraction.extractionText.includes(delim)) {
          throw new Error(
            `Delimiter ${delim} appears inside extraction text ${extraction.extractionText}. This would corrupt alignment mapping.`
          );
        }
        indexToExtraction.set(extractionIndex, { extraction, groupIndex });
        const tokens = tokenizeWithLowercase(extraction.extractionText, tokenizerImpl);
        extractionIndex += tokens.length + delimLen;
      });
    });

    const alignedGroups: Extraction[][] = extractionGroups.map(() => []);
    const tokenizedText: TokenizedText = tokenizerImpl ? tokenizerImpl.tokenize(sourceText) : tokenize(sourceText);

    const alignedExtractions: Extraction[] = [];

    for (const [i, j, n] of matcher.getMatchingBlocks().slice(0, -1)) {
      const mapping = indexToExtraction.get(j);
      if (!mapping) continue;
      const extraction = mapping.extraction;
      extraction.tokenInterval = {
        startIndex: i + tokenOffset,
        endIndex: i + n + tokenOffset,
      } as TokenInterval;

      const startToken = tokenizedText.tokens[i]!;
      const endToken = tokenizedText.tokens[i + n - 1]!;
      extraction.charInterval = {
        startPos: charOffset + startToken.charInterval.startPos,
        endPos: charOffset + endToken.charInterval.endPos,
      } as CharInterval;

      const extractionTextLen = tokenizeWithLowercase(extraction.extractionText, tokenizerImpl).length;
      if (extractionTextLen < n) {
        throw new Error(
          `Delimiter prevents blocks greater than extraction length: extraction_text_len=${extractionTextLen}, block_size=${n}`
        );
      }
      if (extractionTextLen === n) {
        extraction.alignmentStatus = "match_exact";
        alignedExtractions.push(extraction);
      } else {
        if (acceptMatchLesser) {
          extraction.alignmentStatus = "match_lesser";
          alignedExtractions.push(extraction);
        } else {
          extraction.tokenInterval = null;
          extraction.charInterval = null;
          extraction.alignmentStatus = null;
        }
      }
    }

    const unaligned = Array.from(indexToExtraction.values())
      .map((m) => m.extraction)
      .filter((ex) => !alignedExtractions.includes(ex));

    if (enableFuzzy && unaligned.length) {
      for (const extraction of unaligned) {
        const aligned = this.fuzzyAlignExtraction(
          extraction,
          sourceTokens,
          tokenizedText,
          tokenOffset,
          charOffset,
          threshold,
          tokenizerImpl
        );
        if (aligned) {
          alignedExtractions.push(aligned);
        }
      }
    }

    for (const { extraction, groupIndex } of indexToExtraction.values()) {
      alignedGroups[groupIndex]!.push(extraction);
    }

    return alignedGroups;
  }

  private fuzzyAlignExtraction(
    extraction: Extraction,
    sourceTokens: string[],
    tokenizedText: TokenizedText,
    tokenOffset: number,
    charOffset: number,
    threshold: number,
    tokenizerImpl?: Tokenizer | null
  ): Extraction | null {
    const extractionTokens = tokenizeWithLowercase(extraction.extractionText, tokenizerImpl);
    const extractionTokensNorm = extractionTokens.map(normalizeToken);
    if (!extractionTokens.length) return null;

    const lenE = extractionTokensNorm.length;
    const maxWindow = sourceTokens.length;
    const extractionCounts = counter(extractionTokensNorm);
    const minOverlap = Math.floor(lenE * threshold);

    const matcher = new SequenceMatcher();
    matcher.setSeq2(extractionTokensNorm);

    let bestRatio = 0;
    let bestSpan: [number, number] | null = null; // start, window_size

    for (let windowSize = lenE; windowSize <= maxWindow; windowSize += 1) {
      if (windowSize > sourceTokens.length) break;

      let window = sourceTokens.slice(0, windowSize);
      let windowCounts = counter(window.map(normalizeToken));

      for (let startIdx = 0; startIdx <= sourceTokens.length - windowSize; startIdx += 1) {
        if (intersectionTotal(extractionCounts, windowCounts) >= minOverlap) {
          const windowTokensNorm = window.map(normalizeToken);
          matcher.setSeq1(windowTokensNorm);
          const matches = matcher
            .getMatchingBlocks()
            .reduce((sum: number, block: [number, number, number]) => sum + block[2], 0);
          const ratio = lenE > 0 ? matches / lenE : 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestSpan = [startIdx, windowSize];
          }
        }

        if (startIdx + windowSize < sourceTokens.length) {
          const oldToken = window.shift();
          if (oldToken) {
            const oldNorm = normalizeToken(oldToken);
            const count = (windowCounts.get(oldNorm) ?? 0) - 1;
            if (count <= 0) windowCounts.delete(oldNorm);
            else windowCounts.set(oldNorm, count);
          }
          const newToken = sourceTokens[startIdx + windowSize]!;
          window.push(newToken);
          const newNorm = normalizeToken(newToken);
          windowCounts.set(newNorm, (windowCounts.get(newNorm) ?? 0) + 1);
        }
      }
    }

    if (bestSpan && bestRatio >= threshold) {
      const [startIdx, windowSize] = bestSpan;
      try {
        extraction.tokenInterval = {
          startIndex: startIdx + tokenOffset,
          endIndex: startIdx + windowSize + tokenOffset,
        } as TokenInterval;

        const startToken = tokenizedText.tokens[startIdx]!;
        const endToken = tokenizedText.tokens[startIdx + windowSize - 1]!;
        extraction.charInterval = {
          startPos: charOffset + startToken.charInterval.startPos,
          endPos: charOffset + endToken.charInterval.endPos,
        } as CharInterval;
        extraction.alignmentStatus = "match_fuzzy";
        return extraction;
      } catch {
        return null;
      }
    }

    return null;
  }
}
