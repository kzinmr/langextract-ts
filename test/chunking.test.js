import { describe, it, expect } from "vitest";
import { ChunkIterator, SentenceIterator, getTokenIntervalText } from "../src/chunking";
import { RegexTokenizer } from "../src/core/tokenizer";
import { createDocument } from "../src/core/data";
const tok = new RegexTokenizer();
describe("SentenceIterator", () => {
    it("iterates sentences", () => {
        const text = "This is a sentence. This is a longer sentence. Mr. Bond\nasks\nwhy?";
        const tokenized = tok.tokenize(text);
        const iter = new SentenceIterator(tokenized);
        const first = iter.next().value;
        expect(first).toEqual({ startIndex: 0, endIndex: 5 });
        expect(getTokenIntervalText(tokenized, first)).toBe("This is a sentence.");
        const second = iter.next().value;
        expect(second).toEqual({ startIndex: 5, endIndex: 11 });
        expect(getTokenIntervalText(tokenized, second)).toBe("This is a longer sentence.");
    });
});
describe("ChunkIterator", () => {
    it("chunks multiple sentences within buffer", () => {
        const text = "This is a sentence. This is a longer sentence. Mr. Bond\nasks\nwhy?";
        const tokenized = tok.tokenize(text);
        const chunkIter = new ChunkIterator(tokenized, 50, tok);
        const first = chunkIter.next().value;
        expect(first.tokenInterval).toEqual({ startIndex: 0, endIndex: 11 });
        expect(getTokenIntervalText(tokenized, first.tokenInterval)).toBe("This is a sentence. This is a longer sentence.");
    });
    it("breaks long sentence", () => {
        const text = "This is a sentence. This is a longer sentence.";
        const tokenized = tok.tokenize(text);
        const chunkIter = new ChunkIterator(tokenized, 12, tok);
        const first = chunkIter.next().value;
        expect(getTokenIntervalText(tokenized, first.tokenInterval)).toBe("This is a");
    });
    it("handles long token as own chunk", () => {
        const text = "This is a sentence. This is a longer sentence. Mr. Bond\nasks\nwhy?";
        const tokenized = tok.tokenize(text);
        const chunkIter = new ChunkIterator(tokenized, 7, tok);
        const first = chunkIter.next().value;
        expect(getTokenIntervalText(tokenized, first.tokenInterval)).toBe("This is");
        const second = chunkIter.next().value;
        expect(getTokenIntervalText(tokenized, second.tokenInterval)).toBe("a");
        const third = chunkIter.next().value;
        expect(getTokenIntervalText(tokenized, third.tokenInterval)).toBe("sentence");
    });
});
describe("TextChunk document linkage", () => {
    it("propagates tokenizer output into document", () => {
        const doc = createDocument("Some text.");
        const iter = new ChunkIterator(doc.text, 100, tok, doc);
        const chunk = iter.next().value;
        expect(chunk.documentText?.text).toBe("Some text.");
    });
});
//# sourceMappingURL=chunking.test.js.map