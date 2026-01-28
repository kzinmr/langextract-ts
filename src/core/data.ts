import { randomUUID } from "node:crypto";

export type FormatType = "json";

export const EXTRACTIONS_KEY = "extractions" as const;
export const ATTRIBUTE_SUFFIX = "_attributes" as const;

export type AlignmentStatus =
  | "match_exact"
  | "match_greater"
  | "match_lesser"
  | "match_fuzzy";

export interface CharInterval {
  startPos: number;
  endPos: number;
}

export interface Extraction {
  extractionClass: string;
  extractionText: string;
  charInterval?: CharInterval | null;
  alignmentStatus?: AlignmentStatus | null;
  extractionIndex?: number | null;
  groupIndex?: number | null;
  description?: string | null;
  attributes?: Record<string, string | string[]> | null;
  tokenInterval?: TokenInterval | null;
}

export interface AnnotatedDocument {
  documentId: string;
  text: string;
  extractions: Extraction[];
}

export interface ExampleData {
  text: string;
  extractions: Array<{
    extractionClass: string;
    extractionText: string;
    attributes?: Record<string, string | string[]> | null;
  }>;
}

export interface TokenInterval {
  startIndex: number;
  endIndex: number;
}

export interface TokenizedText<TToken> {
  text: string;
  tokens: TToken[];
}

export interface Document<TToken = unknown> {
  text: string;
  documentId: string;
  additionalContext?: string | null;
  tokenizedText?: TokenizedText<TToken> | null;
}

export function createDocument(
  text: string,
  opts?: {
    documentId?: string | null;
    additionalContext?: string | null;
    tokenizedText?: TokenizedText<unknown> | null;
  }
): Document {
  return {
    text,
    documentId: opts?.documentId ?? `doc_${randomUUID().slice(0, 8)}`,
    additionalContext: opts?.additionalContext ?? null,
    tokenizedText: opts?.tokenizedText ?? null,
  };
}
