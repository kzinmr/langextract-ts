import type { TokenInterval } from "../data.js";
import type { TokenizedText, Tokenizer } from "./types.js";
import { InvalidTokenIntervalError } from "../errors.js";
import { RegexTokenizer } from "./regexTokenizer.js";

const DEFAULT_TOKENIZER = new RegexTokenizer();

export function tokenize(text: string, tokenizer: Tokenizer = DEFAULT_TOKENIZER): TokenizedText {
  return tokenizer.tokenize(text);
}

export function tokensText(tokenizedText: TokenizedText, tokenInterval: TokenInterval): string {
  if (tokenInterval.startIndex === tokenInterval.endIndex) {
    return "";
  }

  const total = tokenizedText.tokens.length;
  if (
    tokenInterval.startIndex < 0 ||
    tokenInterval.endIndex > total ||
    tokenInterval.startIndex > tokenInterval.endIndex
  ) {
    throw new InvalidTokenIntervalError(
      `Invalid token interval. start_index=${tokenInterval.startIndex}, end_index=${tokenInterval.endIndex}, total_tokens=${total}.`
    );
  }

  const startToken = tokenizedText.tokens[tokenInterval.startIndex]!;
  const endToken = tokenizedText.tokens[tokenInterval.endIndex - 1]!;
  return tokenizedText.text.slice(
    startToken.charInterval.startPos,
    endToken.charInterval.endPos
  );
}
