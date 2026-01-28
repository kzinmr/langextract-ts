import { describe, it, expect } from "vitest";
import { FormatHandler } from "../src/formatHandler";

const handler = new FormatHandler({ useFences: true });

describe("FormatHandler", () => {
  it("formats extraction example with fences", () => {
    const formatted = handler.formatExtractionExample([
      { extractionClass: "drug", extractionText: "Aspirin", attributes: { dose: "10mg" } },
    ]);
    expect(formatted.startsWith("```json")).toBe(true);
    expect(formatted.includes("extractions")).toBe(true);
  });

  it("parses fenced output and strips think tags", () => {
    const text = "```json\n{\n  \"extractions\": [{\"drug\": \"Aspirin\"}]\n}\n```";
    const parsed = handler.parseOutput(text);
    expect(parsed.length).toBe(1);
    expect(parsed[0].drug).toBe("Aspirin");

    const thinkText = "<think>reasoning</think>" + text;
    const parsed2 = handler.parseOutput(thinkText);
    expect(parsed2[0].drug).toBe("Aspirin");
  });
});
