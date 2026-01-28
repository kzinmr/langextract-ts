import { describe, it, expect } from "vitest";
import { extract } from "../src/extract";
class MockModel {
    async generateJson(prompts, _jsonSchema) {
        return prompts.map(() => ({
            extractions: [{ person: "Jane Doe", drug: "Aspirin" }],
        }));
    }
}
describe("extract", () => {
    it("returns annotated document", async () => {
        const result = await extract({
            text: "Patient Jane Doe received Aspirin.",
            promptDescription: "Extract person and drug",
            examples: [
                {
                    text: "John took Ibuprofen.",
                    extractions: [
                        { extractionClass: "person", extractionText: "John" },
                        { extractionClass: "drug", extractionText: "Ibuprofen" },
                    ],
                },
            ],
            model: new MockModel(),
            options: { tokenizer: "regex", maxCharBuffer: 200 },
        });
        expect(result.extractions.length).toBeGreaterThan(0);
        const person = result.extractions.find((e) => e.extractionClass === "person");
        expect(person?.extractionText).toBe("Jane Doe");
    });
});
//# sourceMappingURL=extract.test.js.map