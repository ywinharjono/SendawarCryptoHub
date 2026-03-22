import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function analyzeMarket(prompt: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: `You are a professional crypto analyst. 
      Your goal is to help users in a crypto forum. 
      You can explain technical indicators like Moving Averages (MA) and Relative Strength Index (RSI). 
      You should provide buy/sell analysis based on technical patterns. 
      Always include a disclaimer that this is not financial advice. 
      Be concise and professional.`,
      tools: [{ googleSearch: {} }],
    },
  });

  return response.text;
}
