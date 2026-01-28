import { describe, it, expect } from "vitest";
import { buildExtractionJsonSchemaFromExamples } from "../src/schemaBuilder";

const examples = [
  {
    text: "Patient Jane Doe took Aspirin.",
    extractions: [
      {
        extractionClass: "person",
        extractionText: "Jane Doe",
        attributes: { age: "30" },
      },
      {
        extractionClass: "drug",
        extractionText: "Aspirin",
        attributes: { dose: ["10mg"] },
      },
    ],
  },
];

describe("schemaBuilder", () => {
  it("builds json schema with property ordering", () => {
    const schema = buildExtractionJsonSchemaFromExamples(examples);
    expect(schema).toHaveProperty("properties");
    // @ts-expect-error dynamic
    expect(schema.propertyOrdering).toEqual(["extractions"]);
    // @ts-expect-error dynamic
    const itemOrdering = schema.properties.extractions.items.propertyOrdering;
    expect(itemOrdering).toContain("person");
    expect(itemOrdering).toContain("person_attributes");
  });
});
