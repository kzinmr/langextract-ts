import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ExampleData } from "./core/data.js";
import { ATTRIBUTE_SUFFIX, EXTRACTIONS_KEY } from "./core/data.js";

export type AttributeValueKind = "string" | "stringArray" | "stringOrStringArray";

export interface CategorySpec {
  name: string;
  attributeNames: string[];
  attributeValueKind: AttributeValueKind;
}

function inferCategorySpecs(examples: ExampleData[]): CategorySpec[] {
  const categoryMap = new Map<string, Map<string, Set<"string" | "stringArray">>>();

  for (const example of examples) {
    for (const extraction of example.extractions) {
      const category = extraction.extractionClass;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, new Map());
      }
      const attrMap = categoryMap.get(category)!;
      const attrs = extraction.attributes ?? {};
      for (const [attrName, attrValue] of Object.entries(attrs)) {
        if (!attrMap.has(attrName)) {
          attrMap.set(attrName, new Set());
        }
        if (Array.isArray(attrValue)) {
          attrMap.get(attrName)!.add("stringArray");
        } else {
          attrMap.get(attrName)!.add("string");
        }
      }
    }
  }

  const specs: CategorySpec[] = [];
  for (const [name, attrMap] of categoryMap.entries()) {
    const attributeNames = Array.from(attrMap.keys());
    let kind: AttributeValueKind = "string";
    if (attributeNames.length === 0) {
      kind = "string";
    } else {
      let hasString = false;
      let hasArray = false;
      for (const attrName of attributeNames) {
        const types = attrMap.get(attrName)!;
        if (types.has("string")) hasString = true;
        if (types.has("stringArray")) hasArray = true;
      }
      if (hasString && hasArray) kind = "stringOrStringArray";
      else if (hasArray) kind = "stringArray";
      else kind = "string";
    }
    specs.push({ name, attributeNames, attributeValueKind: kind });
  }
  return specs;
}

export function buildExtractionZodSchemaFromExamples(
  examples: ExampleData[],
  attributeSuffix: string = ATTRIBUTE_SUFFIX
) {
  const specs = inferCategorySpecs(examples);
  const itemShape: Record<string, z.ZodTypeAny> = {};

  for (const spec of specs) {
    itemShape[spec.name] = z.string().optional().describe(`Extracted text for ${spec.name}`);

    const attrShape: Record<string, z.ZodTypeAny> = {};
    for (const attrName of spec.attributeNames) {
      if (spec.attributeValueKind === "stringArray") {
        attrShape[attrName] = z.array(z.string()).optional();
      } else if (spec.attributeValueKind === "stringOrStringArray") {
        attrShape[attrName] = z.union([z.string(), z.array(z.string())]).optional();
      } else {
        attrShape[attrName] = z.string().optional();
      }
    }
    itemShape[`${spec.name}${attributeSuffix}`] = z
      .object(attrShape)
      .nullable()
      .optional()
      .describe(`Attributes for ${spec.name}`);
  }

  const schema = z.object({
    [EXTRACTIONS_KEY]: z.array(z.object(itemShape).passthrough()),
  });

  return schema;
}

export function buildExtractionJsonSchemaFromExamples(
  examples: ExampleData[],
  attributeSuffix: string = ATTRIBUTE_SUFFIX
) {
  const zodSchema = buildExtractionZodSchemaFromExamples(examples, attributeSuffix);
  const jsonSchema = zodToJsonSchema(zodSchema, "extractionsSchema");

  const specs = inferCategorySpecs(examples);
  const itemOrdering: string[] = [];
  for (const spec of specs) {
    itemOrdering.push(spec.name, `${spec.name}${attributeSuffix}`);
  }

  // Unwrap $ref to the actual schema for Gemini compatibility.
  let root: any = jsonSchema as any;
  if (root.$ref && root.definitions) {
    const ref = String(root.$ref);
    const refName = ref.replace("#/definitions/", "");
    if (root.definitions[refName]) {
      root = root.definitions[refName];
    }
  }

  // Inject propertyOrdering for Gemini if supported
  root.propertyOrdering = [EXTRACTIONS_KEY];
  const properties = root.properties;
  if (properties && properties[EXTRACTIONS_KEY]?.items?.properties) {
    properties[EXTRACTIONS_KEY].items.propertyOrdering = itemOrdering;
  }

  return root;
}
