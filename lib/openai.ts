import OpenAI from "openai";

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY server environment variable");
  }

  if (!client) {
    client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
  }

  return client;
}
