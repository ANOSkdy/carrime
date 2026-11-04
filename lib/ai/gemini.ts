import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

let geminiModel: GenerativeModel | null = null;

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL?.trim();

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing in environment variables');
  }

  if (!modelName) {
    throw new Error('GEMINI_MODEL is missing in environment variables');
  }

  if (!geminiModel) {
    const genAI = new GoogleGenerativeAI(apiKey);
    geminiModel = genAI.getGenerativeModel({ model: modelName });
  }

  return geminiModel;
}

export async function generateContent(prompt: string) {
  try {
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}
