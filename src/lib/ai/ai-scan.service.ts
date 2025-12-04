import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { config as loadEnv } from 'dotenv';
import { FOOD_GROUP_ENUM_STRING } from '../../common/constants/food-group.enum';
import { UNIT_TYPE_ENUM_STRING } from '../../common/constants/unit-type.enum';

loadEnv();

export interface FoodScanResult {
  name: string;
  foodGroup: string;
  notes: string;
  typicalShelfLifeDays_Pantry: number;
  typicalShelfLifeDays_Fridge: number;
  typicalShelfLifeDays_Freezer: number;
  unitType: string;
}

@Injectable()
export class AiScanService {
  private readonly logger = new Logger(AiScanService.name);
  private readonly modelName = 'gemini-2.5-pro';
  private readonly genAI?: GoogleGenerativeAI;

  private readonly prompt = `You are a food information expert. Analyze this food image and identify what food items are visible.

Generate a JSON response with the following structure:

{
  "name": "string (the primary food item name, be specific)",
  "foodGroup": "string (with enum values: ${FOOD_GROUP_ENUM_STRING})",
  "notes": "string (description of the food, its characteristics, or preparation state)",
  "typicalShelfLifeDays_Pantry": number (typical shelf life in days when stored in pantry, 0 if not applicable),
  "typicalShelfLifeDays_Fridge": number (typical shelf life in days when stored in fridge, 0 if not applicable),
  "typicalShelfLifeDays_Freezer": number (typical shelf life in days when stored in freezer, 0 if not applicable),
  "unitType": "string (${UNIT_TYPE_ENUM_STRING})"
}

Rules:
- If multiple distinct food items are detected, return an array of objects (max 5 items)
- If it's a single food item or dish, return a single object
- Be accurate with shelf life estimates based on standard food safety guidelines for fresh, unprocessed foods
- For unitType, use the most appropriate unit based on how the food is typically measured
- IMPORTANT: If foodGroup is "MixedDishes", unitType MUST always be "Count"
- If the image contains prepared/cooked food, estimate shelf life for the prepared state
- Return ONLY valid JSON, no additional text or explanation`;

  constructor() {
    const apiKey = process.env.GEM_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEM_KEY is not configured');
    }
  }

  async scanFoodImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<FoodScanResult[]> {
    if (!this.genAI) {
      throw new Error('Gemini API key is not configured');
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
      });

      const imagePart: Part = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType,
        },
      };

      const result = await model.generateContent([this.prompt, imagePart]);
      const response = await result.response;
      let text = response.text()?.trim();

      if (!text) {
        throw new Error('Gemini returned no content');
      }

      // Clean up markdown code blocks if present
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const parsed = JSON.parse(text);

      // Normalize to array
      const results: FoodScanResult[] = Array.isArray(parsed)
        ? parsed.slice(0, 5)
        : [parsed];

      // Enforce rule: MixedDishes always uses Count
      return results.map((result) => ({
        ...result,
        unitType:
          result.foodGroup === 'MixedDishes' ? 'Count' : result.unitType,
      }));
    } catch (error) {
      const err = error as Error;
      this.logger.error('Gemini food scan failed', err?.stack);
      throw new Error(`Food scan failed: ${err?.message ?? 'Unknown error'}`);
    }
  }

  async generateFoodItemsFromReceipt(
    ocrText: string,
  ): Promise<FoodScanResult[]> {
    if (!this.genAI) {
      throw new Error('Gemini API key is not configured');
    }

    const prompt = `
You are a food receipt analyst. Based on the OCR text from a grocery bill, extract individual food items and map them to structured data.

The OCR text will be provided between triple quotes. Ignore prices or quantities unless helpful for determining unit types. Focus on grocery food items (skip non-food entries).

Return STRICT JSON (no markdown) with this structure:
[
  {
    "name": "string (specific food item)",
    "foodGroup": "string (one of: ${FOOD_GROUP_ENUM_STRING})",
    "notes": "string (include quantity info if available)",
    "typicalShelfLifeDays_Pantry": number (typical shelf life in days when stored in pantry, 0 if not applicable),
    "typicalShelfLifeDays_Fridge": number (typical shelf life in days when stored in fridge, 0 if not applicable),
    "typicalShelfLifeDays_Freezer": number (typical shelf life in days when stored in freezer, 0 if not applicable),
    "unitType": "string (${UNIT_TYPE_ENUM_STRING})"
  }
]

Rules:
- Maximum 10 items.
- If foodGroup is "MixedDishes", unitType must be "Count".
- Shelf life values must be integers (0 when not applicable).
- For unitType, use the most appropriate unit based on OCR text
- Be accurate with shelf life estimates based on standard food safety guidelines for fresh, unprocessed foods
- Only output JSON, no explanation.

OCR TEXT:
"""
${ocrText}
"""
`.trim();

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
      });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text()?.trim();
      if (!text) {
        throw new Error('Gemini returned no content for receipt analysis');
      }

      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const parsed = JSON.parse(text);
      const results: FoodScanResult[] = Array.isArray(parsed)
        ? parsed.slice(0, 10)
        : [parsed];

      return results.map((item) => ({
        ...item,
        unitType: item.foodGroup === 'MixedDishes' ? 'Count' : item.unitType,
      }));
    } catch (error) {
      const err = error as Error;
      this.logger.error('Gemini receipt parsing failed', err?.stack);
      throw new Error(
        `Receipt parsing failed: ${err?.message ?? 'Unknown error'}`,
      );
    }
  }
}

