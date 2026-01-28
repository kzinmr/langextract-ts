import type { Token, TokenizedText, Tokenizer } from "./types.js";
import type { CharInterval } from "../data.js";

const LETTERS_PATTERN = "[\\p{L}\\p{M}]+";
const DIGITS_PATTERN = "[\\p{N}]+";
// Group identical symbols (e.g. "!!") but split mixed ones.
const SYMBOLS_PATTERN = "([^\\p{L}\\p{N}\\s]|_)\\1*";

const TOKEN_PATTERN = new RegExp(
  `${LETTERS_PATTERN}|${DIGITS_PATTERN}|${SYMBOLS_PATTERN}`,
  "gu"
);
const WORD_PATTERN = new RegExp(`(?:${LETTERS_PATTERN}|${DIGITS_PATTERN})$`, "u");
const DIGITS_ONLY = new RegExp(`^${DIGITS_PATTERN}$`, "u");

export class RegexTokenizer implements Tokenizer {
  tokenize(text: string): TokenizedText {
    const tokens: Token[] = [];
    let previousEnd = 0;
    let index = 0;

    for (const match of text.matchAll(TOKEN_PATTERN)) {
      if (match.index === undefined) continue;
      const startPos = match.index;
      const endPos = startPos + match[0].length;
      const matchedText = match[0];

      const charInterval: CharInterval = { startPos, endPos };
      const token: Token = {
        index,
        tokenType: "WORD",
        charInterval,
        firstTokenAfterNewline: false,
      };

      if (index > 0) {
        let hasNewline = text.indexOf("\n", previousEnd) !== -1 && text.indexOf("\n", previousEnd) < startPos;
        if (!hasNewline) {
          hasNewline = text.indexOf("\r", previousEnd) !== -1 && text.indexOf("\r", previousEnd) < startPos;
        }
        if (hasNewline) {
          token.firstTokenAfterNewline = true;
        }
      }

      if (DIGITS_ONLY.test(matchedText)) {
        token.tokenType = "NUMBER";
      } else if (WORD_PATTERN.test(matchedText)) {
        token.tokenType = "WORD";
      } else {
        token.tokenType = "PUNCTUATION";
      }

      tokens.push(token);
      previousEnd = endPos;
      index += 1;
    }

    return { text, tokens };
  }
}
