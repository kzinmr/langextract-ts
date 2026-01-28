import { ATTRIBUTE_SUFFIX, EXTRACTIONS_KEY, type Extraction, type FormatType } from "./core/data.js";
import { FormatParseError } from "./core/errors.js";

const FENCE_START = "```";
const LANGUAGE_TAG = "(?<lang>[A-Za-z0-9_+-]+)?";
const FENCE_NEWLINE = "(?:\\s*\\n)?";
const FENCE_BODY = "(?<body>[\\s\\S]*?)";
const FENCE_END = "```";

const FENCE_RE = new RegExp(
  FENCE_START + LANGUAGE_TAG + FENCE_NEWLINE + FENCE_BODY + FENCE_END,
  "gm"
);

const THINK_TAG_RE = /<think>[\s\S]*?<\/think>\s*/gi;

export type ExtractionValueType = string | number | boolean | null | Record<string, unknown> | Array<unknown>;

export interface FormatHandlerOptions {
  formatType?: FormatType;
  useWrapper?: boolean;
  wrapperKey?: string | null;
  useFences?: boolean;
  attributeSuffix?: string;
  strictFences?: boolean;
  allowTopLevelList?: boolean;
}

export class FormatHandler {
  formatType: FormatType;
  useWrapper: boolean;
  wrapperKey: string | null;
  useFences: boolean;
  attributeSuffix: string;
  strictFences: boolean;
  allowTopLevelList: boolean;

  constructor(opts: FormatHandlerOptions = {}) {
    this.formatType = opts.formatType ?? "json";
    this.useWrapper = opts.useWrapper ?? true;
    if (this.useWrapper) {
      this.wrapperKey = opts.wrapperKey ?? EXTRACTIONS_KEY;
    } else {
      this.wrapperKey = null;
    }
    this.useFences = opts.useFences ?? true;
    this.attributeSuffix = opts.attributeSuffix ?? ATTRIBUTE_SUFFIX;
    this.strictFences = opts.strictFences ?? false;
    this.allowTopLevelList = opts.allowTopLevelList ?? true;
  }

  formatExtractionExample(extractions: Extraction[]): string {
    const items = extractions.map((ext) => ({
      [ext.extractionClass]: ext.extractionText,
      [`${ext.extractionClass}${this.attributeSuffix}`]: ext.attributes ?? {},
    }));

    const payload = this.useWrapper && this.wrapperKey ? { [this.wrapperKey]: items } : items;
    const formatted = JSON.stringify(payload, null, 2);
    return this.useFences ? this.addFences(formatted) : formatted;
  }

  parseOutput(text: string, strict = false): Array<Record<string, ExtractionValueType>> {
    if (!text) {
      throw new FormatParseError("Empty or invalid input string.");
    }

    const content = this.extractContent(text);

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      if (strict) {
        throw new FormatParseError(
          `Failed to parse JSON content: ${(err as Error).message?.slice(0, 200)}`
        );
      }
      if (THINK_TAG_RE.test(content)) {
        const stripped = content.replace(THINK_TAG_RE, "").trim();
        try {
          parsed = JSON.parse(stripped);
        } catch (inner) {
          throw new FormatParseError(
            `Failed to parse JSON content: ${(inner as Error).message?.slice(0, 200)}`
          );
        }
      } else {
        throw new FormatParseError(
          `Failed to parse JSON content: ${(err as Error).message?.slice(0, 200)}`
        );
      }
    }

    if (parsed == null) {
      if (this.useWrapper) {
        throw new FormatParseError(`Content must be a mapping with an '${this.wrapperKey}' key.`);
      }
      throw new FormatParseError("Content must be a list of extractions or a dict.");
    }

    const requireWrapper = this.wrapperKey != null && (this.useWrapper || strict);

    let items: unknown;
    if (Array.isArray(parsed)) {
      if (requireWrapper && (strict || !this.allowTopLevelList)) {
        throw new FormatParseError(`Content must be a mapping with an '${this.wrapperKey}' key.`);
      }
      if (strict && this.useWrapper) {
        throw new FormatParseError("Strict mode requires a wrapper object.");
      }
      if (!this.allowTopLevelList) {
        throw new FormatParseError("Top-level list is not allowed.");
      }
      items = parsed;
    } else if (typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (requireWrapper) {
        if (this.wrapperKey == null || !(this.wrapperKey in obj)) {
          throw new FormatParseError(`Content must contain an '${this.wrapperKey}' key.`);
        }
        items = obj[this.wrapperKey];
      } else {
        if (EXTRACTIONS_KEY in obj) {
          items = obj[EXTRACTIONS_KEY];
        } else if (this.wrapperKey && this.wrapperKey in obj) {
          items = obj[this.wrapperKey];
        } else {
          items = [obj];
        }
      }
    } else {
      throw new FormatParseError(`Expected list or dict, got ${typeof parsed}`);
    }

    if (!Array.isArray(items)) {
      throw new FormatParseError("The extractions must be a sequence (list) of mappings.");
    }

    for (const item of items) {
      if (typeof item !== "object" || item == null || Array.isArray(item)) {
        throw new FormatParseError("Each item in the sequence must be a mapping.");
      }
      for (const key of Object.keys(item)) {
        if (typeof key !== "string") {
          throw new FormatParseError("All extraction keys must be strings (got a non-string key)." );
        }
      }
    }

    return items as Array<Record<string, ExtractionValueType>>;
  }

  private addFences(content: string): string {
    return `\`\`\`json\n${content.trim()}\n\`\`\``;
  }

  private extractContent(text: string): string {
    if (!this.useFences) {
      return text.trim();
    }

    const matches = Array.from(text.matchAll(FENCE_RE));
    const candidates = matches.filter((m) => {
      const lang = m.groups?.lang?.trim().toLowerCase();
      return !lang || lang === "json";
    });

    if (this.strictFences) {
      if (candidates.length !== 1) {
        if (candidates.length === 0) {
          throw new FormatParseError("Input string does not contain valid fence markers.");
        }
        throw new FormatParseError("Multiple fenced blocks found. Expected exactly one.");
      }
      const candidate = candidates[0]!;
      return candidate.groups?.body?.trim() ?? "";
    }

    if (candidates.length === 1) {
      const candidate = candidates[0]!;
      return candidate.groups?.body?.trim() ?? "";
    }

    if (candidates.length > 1) {
      throw new FormatParseError("Multiple fenced blocks found. Expected exactly one.");
    }

    if (matches.length === 1 && !this.strictFences) {
      const match = matches[0]!;
      return match.groups?.body?.trim() ?? "";
    }

    if (matches.length > 0) {
      throw new FormatParseError("No json code block found.");
    }

    return text.trim();
  }
}
