import { describe, it, expect } from "vitest";
import { extract } from "../src/extract";
import type { LanguageModel } from "../src/providers/baseModel";

class MockModel implements LanguageModel {
  async generateJson<T>(prompts: string[], _jsonSchema: Record<string, unknown>): Promise<T[]> {
    return prompts.map(() => ({
      extractions: [{ person: "Jane Doe", drug: "Aspirin" }],
    })) as T[];
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
