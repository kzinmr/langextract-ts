export interface GenerateConfig {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LanguageModel {
  generateJson<T>(
    prompts: string[],
    jsonSchema: Record<string, unknown>,
    config?: GenerateConfig
  ): Promise<T[]>;
}
