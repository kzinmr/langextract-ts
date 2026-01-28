import type { CharInterval, TokenInterval, TokenizedText as CoreTokenizedText } from "../data.js";

export type TokenType = "WORD" | "NUMBER" | "PUNCTUATION";

export interface Token {
  index: number;
  tokenType: TokenType;
  charInterval: CharInterval;
  firstTokenAfterNewline: boolean;
}

export interface TokenizedText extends CoreTokenizedText<Token> {}

export interface Tokenizer {
  tokenize(text: string): TokenizedText;
}

export type { CharInterval, TokenInterval };
