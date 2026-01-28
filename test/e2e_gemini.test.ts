import { describe, it, expect } from "vitest";
import { extract } from "../src/extract.js";
import { GeminiModel } from "../src/providers/gemini/geminiModel.js";

const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
const modelId = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const runLive = Boolean(apiKey);

const vertexProject = process.env.VERTEX_PROJECT;
const vertexLocation = process.env.VERTEX_LOCATION ?? "us-central1";
const vertexModel = process.env.VERTEX_MODEL ?? "gemini-2.5-flash";
const runVertex = Boolean(vertexProject);

const itIf = runLive ? it : it.skip;

describe("Gemini live E2E", () => {
  itIf("extracts entities via real Gemini API", async () => {
    const model = new GeminiModel({ apiKey, model: modelId });

    const result = await extract({
      text: "Patient Jane Doe received Aspirin 10mg today.",
      promptDescription: "Extract person names and medications.",
      examples: [
        {
          text: "John Smith was prescribed Ibuprofen.",
          extractions: [
            { extractionClass: "person", extractionText: "John Smith" },
            { extractionClass: "drug", extractionText: "Ibuprofen" },
          ],
        },
      ],
      model,
      options: { tokenizer: "regex", maxCharBuffer: 200 },
    });

    expect(result.extractions.length).toBeGreaterThan(0);
    const person = result.extractions.find((e) => e.extractionClass === "person");
    const drug = result.extractions.find((e) => e.extractionClass === "drug");
    expect(person?.extractionText).toBeTruthy();
    expect(drug?.extractionText).toBeTruthy();
  }, 30000);
});

const itVertex = runVertex ? it : it.skip;

describe("Vertex AI live E2E", () => {
  itVertex("extracts entities via Vertex AI", async () => {
    const model = new GeminiModel({
      vertexai: true,
      project: vertexProject ?? undefined,
      location: vertexLocation,
      model: vertexModel,
    });

    const result = await extract({
      text: "Patient Jane Doe received Aspirin 10mg today.",
      promptDescription: "Extract person names and medications.",
      examples: [
        {
          text: "John Smith was prescribed Ibuprofen.",
          extractions: [
            { extractionClass: "person", extractionText: "John Smith" },
            { extractionClass: "drug", extractionText: "Ibuprofen" },
          ],
        },
      ],
      model,
      options: { tokenizer: "regex", maxCharBuffer: 200 },
    });

    expect(result.extractions.length).toBeGreaterThan(0);
    const person = result.extractions.find((e) => e.extractionClass === "person");
    const drug = result.extractions.find((e) => e.extractionClass === "drug");
    expect(person?.extractionText).toBeTruthy();
    expect(drug?.extractionText).toBeTruthy();
  }, 30000);
});
