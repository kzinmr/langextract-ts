import { createDocument, type CharInterval, type Document, type TokenInterval } from "./core/data.js";
import type { TokenizedText, Tokenizer } from "./core/tokenizer/index.js";
import { tokensText, findSentenceRange } from "./core/tokenizer/index.js";
import { InvalidTokenIntervalError } from "./core/errors.js";

export class TokenUtilError extends Error {}

export class TextChunk {
  tokenInterval: TokenInterval;
  document: Document | null;
  private _chunkText: string | null = null;
  private _sanitizedChunkText: string | null = null;
  private _charInterval: CharInterval | null = null;

  constructor(opts: { tokenInterval: TokenInterval; document?: Document | null }) {
    this.tokenInterval = opts.tokenInterval;
    this.document = opts.document ?? null;
  }

  get documentId(): string | null {
    return this.document ? this.document.documentId : null;
  }

  get documentText(): TokenizedText | null {
    return (this.document?.tokenizedText as TokenizedText | null) ?? null;
  }

  get chunkText(): string {
    if (!this.documentText) {
      throw new Error("document_text must be set to access chunk_text.");
    }
    if (this._chunkText === null) {
      this._chunkText = getTokenIntervalText(this.documentText, this.tokenInterval);
    }
    return this._chunkText;
  }

  get sanitizedChunkText(): string {
    if (this._sanitizedChunkText === null) {
      this._sanitizedChunkText = sanitize(this.chunkText);
    }
    return this._sanitizedChunkText;
  }

  get additionalContext(): string | null {
    return this.document?.additionalContext ?? null;
  }

  get charInterval(): CharInterval {
    if (!this._charInterval) {
      if (!this.documentText) {
        throw new Error("document_text must be set to compute char_interval.");
      }
      this._charInterval = getCharInterval(this.documentText, this.tokenInterval);
    }
    return this._charInterval;
  }

  toString(): string {
    const intervalRepr = `start_index: ${this.tokenInterval.startIndex}, end_index: ${this.tokenInterval.endIndex}`;
    const docIdRepr = this.documentId ? `Document ID: ${this.documentId}` : "Document ID: None";
    let chunkTextRepr = "<unavailable: document_text not set>";
    try {
      chunkTextRepr = `'${this.chunkText}'`;
    } catch {
      // ignore
    }
    return `TextChunk(\n  interval=[${intervalRepr}],\n  ${docIdRepr},\n  Chunk Text: ${chunkTextRepr}\n)`;
  }
}

export function createTokenInterval(startIndex: number, endIndex: number): TokenInterval {
  if (startIndex < 0) {
    throw new Error(`Start index ${startIndex} must be positive.`);
  }
  if (startIndex >= endIndex) {
    throw new Error(`Start index ${startIndex} must be < end index ${endIndex}.`);
  }
  return { startIndex, endIndex };
}

export function getTokenIntervalText(tokenizedText: TokenizedText, tokenInterval: TokenInterval): string {
  if (tokenInterval.startIndex >= tokenInterval.endIndex) {
    throw new Error(
      `Start index ${tokenInterval.startIndex} must be < end index ${tokenInterval.endIndex}.`
    );
  }
  const returnString = tokensText(tokenizedText, tokenInterval);
  if (tokenizedText.text && !returnString) {
    throw new TokenUtilError(
      `Token util returns an empty string unexpectedly. Number of tokens is tokenized_text: ${tokenizedText.tokens.length}, token_interval is ${tokenInterval.startIndex} to ${tokenInterval.endIndex}, which should not lead to empty string.`
    );
  }
  return returnString;
}

export function getCharInterval(tokenizedText: TokenizedText, tokenInterval: TokenInterval): CharInterval {
  if (tokenInterval.startIndex >= tokenInterval.endIndex) {
    throw new Error(
      `Start index ${tokenInterval.startIndex} must be < end index ${tokenInterval.endIndex}.`
    );
  }
  const startToken = tokenizedText.tokens[tokenInterval.startIndex]!;
  const finalToken = tokenizedText.tokens[tokenInterval.endIndex - 1]!;
  return {
    startPos: startToken.charInterval.startPos,
    endPos: finalToken.charInterval.endPos,
  };
}

function sanitize(text: string): string {
  const sanitized = text.trim().replace(/\s+/g, " ");
  if (!sanitized) {
    throw new Error("Sanitized text is empty.");
  }
  return sanitized;
}

export function* makeBatchesOfTextChunk(
  chunkIter: Iterable<TextChunk>,
  batchLength: number
): Iterable<TextChunk[]> {
  let batch: TextChunk[] = [];
  for (const chunk of chunkIter) {
    batch.push(chunk);
    if (batch.length >= batchLength) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length) {
    yield batch;
  }
}

export class SentenceIterator implements IterableIterator<TokenInterval> {
  private tokenizedText: TokenizedText;
  private tokenLen: number;
  private currTokenPos: number;

  constructor(tokenizedText: TokenizedText, currTokenPos = 0) {
    this.tokenizedText = tokenizedText;
    this.tokenLen = tokenizedText.tokens.length;
    if (currTokenPos < 0) {
      throw new Error(`Current token position ${currTokenPos} can not be negative.`);
    } else if (currTokenPos > this.tokenLen) {
      throw new Error(
        `Current token position ${currTokenPos} is past the length of the document ${this.tokenLen}.`
      );
    }
    this.currTokenPos = currTokenPos;
  }

  [Symbol.iterator](): IterableIterator<TokenInterval> {
    return this;
  }

  next(): IteratorResult<TokenInterval> {
    if (this.currTokenPos === this.tokenLen) {
      return { done: true, value: undefined as never };
    }

    const sentenceRange = findSentenceRange(
      this.tokenizedText.text,
      this.tokenizedText.tokens,
      this.currTokenPos
    );
    const interval = createTokenInterval(this.currTokenPos, sentenceRange.endIndex);
    this.currTokenPos = sentenceRange.endIndex;
    return { done: false, value: interval };
  }
}

export class ChunkIterator implements IterableIterator<TextChunk> {
  private tokenizedText: TokenizedText;
  private maxCharBuffer: number;
  private sentenceIter: SentenceIterator;
  private brokenSentence = false;
  private document: Document;

  constructor(
    text: string | TokenizedText | null,
    maxCharBuffer: number,
    tokenizerImpl: Tokenizer,
    document?: Document | null
  ) {
    if (text == null) {
      if (!document) {
        throw new Error("Either text or document must be provided.");
      }
      text = document.text || "";
    }

    if (typeof text === "string") {
      text = tokenizerImpl.tokenize(text);
    } else if (text && text.tokens.length === 0) {
      const textToTokenize = text.text || document?.text || "";
      text = tokenizerImpl.tokenize(textToTokenize);
    }

    this.tokenizedText = text as TokenizedText;
    this.maxCharBuffer = maxCharBuffer;
    this.sentenceIter = new SentenceIterator(this.tokenizedText);

    if (!document) {
      this.document = createDocument(this.tokenizedText.text);
    } else {
      this.document = document;
    }
    this.document.tokenizedText = this.tokenizedText;
  }

  [Symbol.iterator](): IterableIterator<TextChunk> {
    return this;
  }

  private tokensExceedBuffer(tokenInterval: TokenInterval): boolean {
    const charInterval = getCharInterval(this.tokenizedText, tokenInterval);
    return charInterval.endPos - charInterval.startPos > this.maxCharBuffer;
  }

  next(): IteratorResult<TextChunk> {
    const sentenceResult = this.sentenceIter.next();
    if (sentenceResult.done) {
      return { done: true, value: undefined as never };
    }

    const sentence = sentenceResult.value;

    let currChunk = createTokenInterval(sentence.startIndex, sentence.startIndex + 1);
    if (this.tokensExceedBuffer(currChunk)) {
      this.sentenceIter = new SentenceIterator(this.tokenizedText, sentence.startIndex + 1);
      this.brokenSentence = currChunk.endIndex < sentence.endIndex;
      return { done: false, value: new TextChunk({ tokenInterval: currChunk, document: this.document }) };
    }

    let startOfNewLine = -1;
    for (let tokenIndex = currChunk.startIndex; tokenIndex < sentence.endIndex; tokenIndex += 1) {
      if (this.tokenizedText.tokens[tokenIndex]!.firstTokenAfterNewline) {
        startOfNewLine = tokenIndex;
      }
      const testChunk = createTokenInterval(currChunk.startIndex, tokenIndex + 1);
      if (this.tokensExceedBuffer(testChunk)) {
        if (startOfNewLine > 0 && startOfNewLine > currChunk.startIndex) {
          currChunk = createTokenInterval(currChunk.startIndex, startOfNewLine);
        }
        this.sentenceIter = new SentenceIterator(this.tokenizedText, currChunk.endIndex);
        this.brokenSentence = true;
        return { done: false, value: new TextChunk({ tokenInterval: currChunk, document: this.document }) };
      } else {
        currChunk = testChunk;
      }
    }

    if (this.brokenSentence) {
      this.brokenSentence = false;
    } else {
      for (const sentenceInterval of this.sentenceIter) {
        const testChunk = createTokenInterval(currChunk.startIndex, sentenceInterval.endIndex);
        if (this.tokensExceedBuffer(testChunk)) {
          this.sentenceIter = new SentenceIterator(this.tokenizedText, currChunk.endIndex);
          return { done: false, value: new TextChunk({ tokenInterval: currChunk, document: this.document }) };
        } else {
          currChunk = testChunk;
        }
      }
    }

    return { done: false, value: new TextChunk({ tokenInterval: currChunk, document: this.document }) };
  }
}
