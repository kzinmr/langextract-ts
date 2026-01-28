import type { Token, TokenInterval } from "./types.js";
import { SentenceRangeError } from "../errors.js";

const END_OF_SENTENCE_RE = /[.?!。！？\u0964]["'”’»)\]}]*$/u;
const KNOWN_ABBREVIATIONS = new Set(["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "St."]);
const CLOSING_PUNCTUATION = new Set(['"', "'", "”", "’", "»", ")", "]", "}"]);

function isLowercaseChar(char: string): boolean {
  return /^\p{Ll}$/u.test(char);
}

function tokenText(text: string, token: Token): string {
  return text.slice(token.charInterval.startPos, token.charInterval.endPos);
}

function isEndOfSentenceToken(
  text: string,
  tokens: Token[],
  currentIdx: number,
  knownAbbreviations: Set<string>
): boolean {
  const currentTokenText = tokenText(text, tokens[currentIdx]!);
  if (END_OF_SENTENCE_RE.test(currentTokenText)) {
    if (currentIdx > 0) {
      const prevTokenText = tokenText(text, tokens[currentIdx - 1]!);
      if (knownAbbreviations.has(`${prevTokenText}${currentTokenText}`)) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function isSentenceBreakAfterNewline(text: string, tokens: Token[], currentIdx: number): boolean {
  if (currentIdx + 1 >= tokens.length) return false;
  const nextToken = tokens[currentIdx + 1]!;
  if (!nextToken.firstTokenAfterNewline) return false;
  const nextTokenText = tokenText(text, nextToken);
  if (!nextTokenText) return false;
  return !isLowercaseChar(nextTokenText[0] ?? "");
}

export function findSentenceRange(
  text: string,
  tokens: Token[],
  startTokenIndex: number,
  knownAbbreviations: Set<string> = KNOWN_ABBREVIATIONS
): TokenInterval {
  if (!tokens.length) {
    return { startIndex: 0, endIndex: 0 };
  }

  if (startTokenIndex < 0 || startTokenIndex >= tokens.length) {
    throw new SentenceRangeError(
      `start_token_index=${startTokenIndex} out of range. Total tokens: ${tokens.length}.`
    );
  }

  let i = startTokenIndex;
  while (i < tokens.length) {
    if (tokens[i]!.tokenType === "PUNCTUATION") {
      if (isEndOfSentenceToken(text, tokens, i, knownAbbreviations)) {
        let endIndex = i + 1;
        while (endIndex < tokens.length) {
          const nextText = tokenText(text, tokens[endIndex]!);
          if (tokens[endIndex]!.tokenType === "PUNCTUATION" && CLOSING_PUNCTUATION.has(nextText)) {
            endIndex += 1;
          } else {
            break;
          }
        }
        return { startIndex: startTokenIndex, endIndex };
      }
    }
    if (isSentenceBreakAfterNewline(text, tokens, i)) {
      return { startIndex: startTokenIndex, endIndex: i + 1 };
    }
    i += 1;
  }

  return { startIndex: startTokenIndex, endIndex: tokens.length };
}

export const DEFAULT_ABBREVIATIONS = KNOWN_ABBREVIATIONS;
