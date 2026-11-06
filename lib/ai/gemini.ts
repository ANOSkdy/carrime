import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { AiError, providerError } from './errors';

let geminiModel: GenerativeModel | null = null;

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelName = process.env.GEMINI_MODEL?.trim();

  if (!apiKey) {
    throw new AiError('AI_NOT_CONFIGURED', 'AI生成の接続設定がありません。管理者へお問い合わせください。', 503, false, 'configuration');
  }

  if (!modelName) {
    throw new AiError('AI_NOT_CONFIGURED', 'AI生成のモデル設定がありません。管理者へお問い合わせください。', 503, false, 'configuration');
  }

  if (!geminiModel) {
    const genAI = new GoogleGenerativeAI(apiKey);
    geminiModel = genAI.getGenerativeModel({ model: modelName });
  }

  return geminiModel;
}

export async function generateContent(prompt: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40_000);
  try {
    const model = getGeminiModel();
    // One provider request per user action. Automatic POST retries could create
    // duplicate generations/charges after an uncertain network failure.
    const result = await model.generateContent(prompt, { signal: controller.signal });
    const response = await result.response;
    let text: string;
    try { text = response.text(); }
    catch (error) {
      const failure = providerError(error);
      failure.upstreamStatus = 200;
      throw failure;
    }
    if (!text.trim()) throw new AiError('AI_EMPTY_RESPONSE', 'AIから文章を取得できませんでした。再試行してください。', 502, true, 'response', 200);
    return text;
  } catch (error) {
    throw error instanceof AiError ? error : providerError(error);
  } finally {
    clearTimeout(timer);
  }
}
