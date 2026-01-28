# langextract-ts

[LangExtract](https://github.com/google/langextract) core pipeline ported from the Python implementation to Node.js/TypeScript.
Focuses on tokenizer → chunking → prompting → structured output → resolver/alignment → annotated document.

## Requirements

- Node.js 20+
- ESM (this package is `"type": "module"`)

## Install

```bash
pnpm install
```

## Quick start (Gemini Developer API)

```ts
import { extract } from "./src/extract.js";
import { GeminiModel } from "./src/providers/gemini/geminiModel.js";

const model = new GeminiModel({
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-2.5-flash",
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

console.log(result.extractions);
```

## Vertex AI (Gemini on Vertex)

```ts
import { extract } from "./src/extract.js";
import { GeminiModel } from "./src/providers/gemini/geminiModel.js";

const model = new GeminiModel({
  vertexai: true,
  project: process.env.VERTEX_PROJECT,
  location: process.env.VERTEX_LOCATION ?? "us-central1",
  model: process.env.VERTEX_MODEL ?? "gemini-2.5-flash",
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
});

console.log(result.extractions);
```

### Vertex credentials via `GOOGLE_APPLICATION_CREDENTIALS`

For Vertex AI, credentials can be provided via `GOOGLE_APPLICATION_CREDENTIALS` in two forms:

- File path to a service account JSON
- Raw JSON string (the library will write it to a temp file internally)

## API overview

### `extract(input)`

```ts
export interface ExtractInput {
  text: string;
  promptDescription: string;
  examples: ExampleData[];
  model: LanguageModel;
  options?: ExtractOptions;
}
```

```ts
export interface ExtractOptions {
  additionalContext?: string;
  tokenizer?: "unicode" | "regex" | Tokenizer;
  maxCharBuffer?: number;

  enableFuzzyAlignment?: boolean;
  fuzzyAlignmentThreshold?: number;
  acceptMatchLesser?: boolean;

  attributeSuffix?: string;
  useStructuredOutput?: boolean;

  passes?: number;
  contextWindowChars?: number | null;

  concurrency?: {
    maxConcurrency?: number;
    batchSize?: number;
  };

  debug?: boolean;
}
```

### Tokenizers

- `RegexTokenizer`: faster for Latin-based text.
- `UnicodeTokenizer`: UAX #29 grapheme segmentation, recommended for CJK and non‑spaced scripts.

### Char offsets

`charInterval` uses JS UTF‑16 code unit offsets (compatible with `String.prototype.slice`).

## Tests

Unit tests:

```bash
pnpm test
```

Live E2E (Gemini Developer API):

```bash
GEMINI_API_KEY=your_key pnpm vitest -t "Gemini live E2E"
```

Live E2E (Vertex AI):

```bash
VERTEX_PROJECT=your-project \
VERTEX_LOCATION=us-central1 \
VERTEX_MODEL=gemini-2.5-flash \
pnpm vitest -t "Vertex AI live E2E"
```

## Notes

- HTML visualization features are intentionally out of scope.
- Structured output is enforced via JSON Schema derived from examples (zod → JSON Schema).
