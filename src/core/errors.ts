export class LangExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidTokenIntervalError extends LangExtractError {}
export class SentenceRangeError extends LangExtractError {}
export class FormatParseError extends LangExtractError {}
export class ResolverParsingError extends LangExtractError {}
export class InferenceOutputError extends LangExtractError {}
export class InvalidDocumentError extends LangExtractError {}
