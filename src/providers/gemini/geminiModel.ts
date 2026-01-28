import { GoogleGenAI } from "@google/genai";
import type { GenerateConfig, LanguageModel } from "../baseModel.js";

export interface GeminiModelOptions {
  apiKey?: string;
  vertexai?: boolean;
  project?: string;
  location?: string;
  model: string;
  apiVersion?: string;
}

export class GeminiModel implements LanguageModel {
  private ai: GoogleGenAI;
  private modelId: string;

  constructor(opts: GeminiModelOptions) {
    this.ai = new GoogleGenAI({
      apiKey: opts.apiKey,
      vertexai: opts.vertexai,
      project: opts.project,
      location: opts.location,
      apiVersion: opts.apiVersion,
    });
    this.modelId = opts.model;
  }

  async generateJson<T>(
    prompts: string[],
    jsonSchema: Record<string, unknown>,
    config?: GenerateConfig
  ): Promise<T[]> {
    const results: T[] = [];
    for (const prompt of prompts) {
      const genConfig: Record<string, unknown> = {
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        temperature: config?.temperature,
        maxOutputTokens: config?.maxOutputTokens,
      };
      const resp = await this.ai.models.generateContent({
        model: config?.model ?? this.modelId,
        contents: prompt,
        config: genConfig as any,
      });
      const text = (resp as any).text ?? (resp as any).response?.text;
      if (!text) {
        throw new Error("Gemini response missing text field.");
      }
      results.push(JSON.parse(text) as T);
    }
    return results;
  }
}
