import type { Token, TokenType, TokenizedText, Tokenizer } from "./types.js";
import type { CharInterval } from "../data.js";

const LETTER_RE = /^\p{L}/u;
const NUMBER_RE = /^\p{N}/u;
const WHITESPACE_RE = /^\s+$/u;

const CJK_RE = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u;
const NON_SPACED_RE = /\p{Script=Thai}|\p{Script=Lao}|\p{Script=Khmer}|\p{Script=Myanmar}/u;

const COMMON_SCRIPTS = [
  "Latin",
  "Cyrillic",
  "Greek",
  "Arabic",
  "Hebrew",
  "Devanagari",
] as const;

const COMMON_SCRIPT_PATTERNS: Record<(typeof COMMON_SCRIPTS)[number], RegExp> = {
  Latin: /\p{Script=Latin}/u,
  Cyrillic: /\p{Script=Cyrillic}/u,
  Greek: /\p{Script=Greek}/u,
  Arabic: /\p{Script=Arabic}/u,
  Hebrew: /\p{Script=Hebrew}/u,
  Devanagari: /\p{Script=Devanagari}/u,
};

const NO_GROUP = "NO_GROUP" as const;
const UNKNOWN = "UNKNOWN" as const;

function classifyGrapheme(grapheme: string): TokenType {
  if (!grapheme) return "PUNCTUATION";
  const c = grapheme[0] ?? "";
  if (LETTER_RE.test(c)) return "WORD";
  if (NUMBER_RE.test(c)) return "NUMBER";
  return "PUNCTUATION";
}

function getScriptFast(char: string): string {
  const codePoint = char.codePointAt(0);
  if (codePoint !== undefined && codePoint < 128) {
    return "Latin";
  }
  for (const script of COMMON_SCRIPTS) {
    if (COMMON_SCRIPT_PATTERNS[script].test(char)) {
      return script;
    }
  }
  return UNKNOWN;
}

function isCjk(char: string): boolean {
  return CJK_RE.test(char);
}

function isNonSpaced(char: string): boolean {
  return NON_SPACED_RE.test(char);
}

export class UnicodeTokenizer implements Tokenizer {
  private segmenter: Intl.Segmenter;

  constructor() {
    this.segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  }

  tokenize(text: string): TokenizedText {
    const tokens: Token[] = [];

    let currentStart = 0;
    let currentType: TokenType | null = null;
    let currentScript: string | typeof NO_GROUP | typeof UNKNOWN | null = null;
    let previousEnd = 0;

    for (const segment of this.segmenter.segment(text)) {
      const grapheme = segment.segment;
      const start = segment.index;

      if (WHITESPACE_RE.test(grapheme)) {
        if (currentType !== null) {
          this.emitToken(tokens, text, currentStart, start, currentType, previousEnd);
          previousEnd = start;
          currentType = null;
          currentScript = null;
        }
        continue;
      }

      const gType = classifyGrapheme(grapheme);
      let shouldMerge = false;

      if (currentType !== null && currentType === gType) {
        if (currentType === "WORD") {
          const firstChar = grapheme[0] ?? "";
          if (currentScript === NO_GROUP) {
            shouldMerge = false;
          } else if (firstChar && (isCjk(firstChar) || isNonSpaced(firstChar))) {
            shouldMerge = false;
          } else {
            const gScript = firstChar ? getScriptFast(firstChar) : UNKNOWN;
            if (currentScript === gScript && currentScript !== UNKNOWN) {
              shouldMerge = true;
            }
          }
        } else if (currentType === "NUMBER") {
          shouldMerge = true;
        } else if (currentType === "PUNCTUATION") {
          const lastGrapheme = text.slice(currentStart, start);
          if (lastGrapheme === grapheme) {
            shouldMerge = true;
          } else if (
            lastGrapheme.length >= grapheme.length &&
            lastGrapheme.endsWith(grapheme)
          ) {
            shouldMerge = true;
          }
        }
      }

      if (!shouldMerge) {
        if (currentType !== null) {
          this.emitToken(tokens, text, currentStart, start, currentType, previousEnd);
          previousEnd = start;
        }

        currentStart = start;
        currentType = gType;

        if (currentType === "WORD") {
          const c = grapheme[0] ?? "";
          if (c && (isCjk(c) || isNonSpaced(c))) {
            currentScript = NO_GROUP;
          } else {
            currentScript = c ? getScriptFast(c) : UNKNOWN;
          }
        } else {
          currentScript = null;
        }
      }
    }

    if (currentType !== null) {
      this.emitToken(tokens, text, currentStart, text.length, currentType, previousEnd);
    }

    return { text, tokens };
  }

  private emitToken(
    tokens: Token[],
    text: string,
    start: number,
    end: number,
    tokenType: TokenType,
    previousEnd: number
  ) {
    const charInterval: CharInterval = { startPos: start, endPos: end };
    const token: Token = {
      index: tokens.length,
      tokenType,
      charInterval,
      firstTokenAfterNewline: false,
    };

    if (start > previousEnd) {
      const gap = text.slice(previousEnd, start);
      if (gap.includes("\n") || gap.includes("\r")) {
        token.firstTokenAfterNewline = true;
      }
    }

    tokens.push(token);
  }
}
