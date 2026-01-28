import { describe, it, expect } from "vitest";
import { FormatHandler } from "../src/formatHandler";
import { QAPromptGenerator, ContextAwarePromptBuilder } from "../src/prompting";
const handler = new FormatHandler({ useFences: false });
const template = {
    description: "Extract entities",
    examples: [
        {
            text: "Jane took Aspirin.",
            extractions: [{ extractionClass: "drug", extractionText: "Aspirin" }],
        },
    ],
};
describe("Prompting", () => {
    it("renders prompt with examples", () => {
        const gen = new QAPromptGenerator(template, handler);
        const prompt = gen.render("Test text");
        expect(prompt).toContain("Extract entities");
        expect(prompt).toContain("Examples");
        expect(prompt).toContain("Q: Test text");
    });
    it("adds context for subsequent chunk", () => {
        const gen = new QAPromptGenerator(template, handler);
        const builder = new ContextAwarePromptBuilder(gen, 5);
        const first = builder.buildPrompt("Hello world", "doc1");
        const second = builder.buildPrompt("Second chunk", "doc1");
        expect(first).toContain("Q: Hello world");
        expect(second).toContain("[Previous text]: ...world");
    });
});
//# sourceMappingURL=prompting.test.js.map