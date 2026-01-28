import { describe, it, expect } from "vitest";
import { RegexTokenizer, UnicodeTokenizer, tokenize, tokensText, findSentenceRange, } from "../src/core/tokenizer";
import { InvalidTokenIntervalError, SentenceRangeError } from "../src/core/errors";
function tokensToTypes(tokens) {
    return tokens.map((t) => t.tokenType);
}
describe("RegexTokenizer", () => {
    it("tokenizes basic text", () => {
        const tokenized = tokenize("Hello, world!");
        expect(tokensToTypes(tokenized.tokens)).toEqual([
            "WORD",
            "PUNCTUATION",
            "WORD",
            "PUNCTUATION",
        ]);
    });
    it("marks first token after newline", () => {
        const tok = new RegexTokenizer();
        const tokenized = tok.tokenize("Line1\nLine2");
        expect(tokenized.tokens[0].firstTokenAfterNewline).toBe(false);
        expect(tokenized.tokens[2].firstTokenAfterNewline).toBe(true);
    });
    it("splits underscores as punctuation", () => {
        const tok = new RegexTokenizer();
        const tokenized = tok.tokenize("user_id");
        expect(tokensToTypes(tokenized.tokens)).toEqual([
            "WORD",
            "PUNCTUATION",
            "WORD",
        ]);
    });
});
describe("UnicodeTokenizer", () => {
    it("splits CJK characters", () => {
        const tok = new UnicodeTokenizer();
        const tokenized = tok.tokenize("こんにちは、世界！");
        expect(tokenized.tokens.length).toBe(9);
        expect(tokenized.tokens[5].tokenType).toBe("PUNCTUATION");
    });
    it("keeps script boundaries", () => {
        const tok = new UnicodeTokenizer();
        const tokenized = tok.tokenize("HelloПривет");
        expect(tokenized.tokens.length).toBe(2);
        const t1 = tokenized.text.slice(tokenized.tokens[0].charInterval.startPos, tokenized.tokens[0].charInterval.endPos);
        const t2 = tokenized.text.slice(tokenized.tokens[1].charInterval.startPos, tokenized.tokens[1].charInterval.endPos);
        expect(t1).toBe("Hello");
        expect(t2).toBe("Привет");
    });
    it("groups identical punctuation", () => {
        const tok = new UnicodeTokenizer();
        const text = "Hello!! World...";
        const tokens = tok.tokenize(text).tokens;
        const texts = tokens.map((t) => text.slice(t.charInterval.startPos, t.charInterval.endPos));
        expect(texts).toEqual(["Hello", "!!", "World", "..."]);
    });
    it("detects newline in gap", () => {
        const tok = new UnicodeTokenizer();
        const tokenized = tok.tokenize("a\n b");
        expect(tokenized.tokens[1].firstTokenAfterNewline).toBe(true);
    });
});
describe("tokensText", () => {
    it("returns correct substring", () => {
        const input = "Patient Jane Doe, ID 67890.";
        const tokenized = tokenize(input);
        const result = tokensText(tokenized, { startIndex: 1, endIndex: 3 });
        expect(result).toBe("Jane Doe");
    });
    it("throws for invalid interval", () => {
        const tokenized = tokenize("Hello");
        expect(() => tokensText(tokenized, { startIndex: -1, endIndex: 1 })).toThrow(InvalidTokenIntervalError);
    });
});
describe("findSentenceRange", () => {
    it("handles abbreviations", () => {
        const text = "Dr. John visited. Then left.";
        const tokenized = tokenize(text);
        const interval = findSentenceRange(text, tokenized.tokens, 0);
        expect(interval.endIndex).toBe(5);
    });
    it("respects unicode sentence terminators", () => {
        const text = "こんにちは。世界。";
        const tokenized = new UnicodeTokenizer().tokenize(text);
        const interval = findSentenceRange(text, tokenized.tokens, 0);
        expect(interval.endIndex).toBe(6);
    });
    it("throws for invalid start", () => {
        const text = "Hello world.";
        const tokenized = tokenize(text);
        expect(() => findSentenceRange(text, tokenized.tokens, -1)).toThrow(SentenceRangeError);
    });
});
//# sourceMappingURL=tokenizer.test.js.map