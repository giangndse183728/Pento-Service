import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config as loadEnv } from 'dotenv';

loadEnv();

export type ChatResponse = {
  role: 'assistant';
  content: string;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly modelName = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  private readonly systemPrompt = `You are PENTO Assistant for "The Smart Households Food Management System" mobile app.

Answer briefly, clearly, and helpfully in the user's language.

You specialize in food management topics including: food inventory, barcode scanning, food recognition, expiry tracking, AI recipe suggestions, grocery planning, food sharing/giveaway, notifications, and app usage/onboarding. However, you can also help with general cooking, nutrition, food safety, and related questions.

When relevant, suggest in-app flows (e.g., open Scanner, add item, set expiry, view alerts) to help users make the most of the PENTO app features.

IMPORTANT: If you receive information about nearly expired food items, proactively provide helpful suggestions such as:
- Specific recipes that use those items (include ingredients and simple instructions)
- Preservation methods to extend their shelf life (freezing, canning, pickling, etc.)
- Creative ways to use them before they expire
- Storage tips specific to each food type
- Meal planning ideas incorporating those items

Be practical, specific, and actionable in your suggestions. Prioritize items expiring soonest.`;
  private readonly genAI?: GoogleGenerativeAI;

  constructor() {
    const apiKey =
      process.env.GEM_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY is not configured');
    }
  }

  async chat(message: string): Promise<ChatResponse> {
    if (!this.genAI) {
      return this.buildResponse('Gemini API key is not configured.');
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
      });

      const result = await model.generateContent(
        `${this.systemPrompt}\n\nUser ask: ${message}`,
      );
      const response = await result.response;
      const text = response.text()?.trim();

      if (!text) {
        return this.buildResponse('Gemini returned no content.');
      }

      return this.buildResponse(text);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Gemini chat failed', err?.stack);
      return this.buildResponse(
        `Error with Gemini AI service: ${err?.message ?? 'Unknown error occurred'}`,
      );
    }
  }

  private buildResponse(content: string): ChatResponse {
    return { role: 'assistant', content };
  }
}

