// lib/ai.ts
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

let cachedModel: GenerativeModel | null = null;

/**
 * Returns a Gemini model instance if GEMINI_API_KEY is set.
 * If not, returns null so the caller can fall back to a mock agent.
 */
export function getAiModel(): GenerativeModel | null {
  const apiKey = process.env.GEMINI_API_KEY;

  // If no key, don't crash the app – just log and let caller fallback.
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set – agent will use mock generator.");
    return null;
  }

  if (!cachedModel) {
    const genAI = new GoogleGenerativeAI(apiKey);
    cachedModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash" 
    });
  }

  return cachedModel;
}
