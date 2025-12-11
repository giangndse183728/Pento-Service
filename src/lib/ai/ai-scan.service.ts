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

export interface ExtractedProductInfo {
  name: string;
  brand: string | null;
  categories: string[];
  foodGroupHints: string[];
  quantity: string | null;
  servingSize: string | null;
  servingQuantity: number | null;
  productQuantity: number | null;
  ingredients: string | null;
  labels: string[];
  packaging: string[];
  nutriments: Record<string, unknown> | null;
  nutriscoreGrade: string | null;
  novaGroup: number | null;
  ecoscoreGrade: string | null;
  keywords: string[];
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

  async normalizeProductDataFromBarcode(
    extractedInfo: ExtractedProductInfo,
  ): Promise<FoodScanResult> {
    if (!this.genAI) {
      // Fallback: return basic result without AI enhancement
      this.logger.warn('Gemini not configured, returning basic result');
      return this.createBasicResultFromProductInfo(extractedInfo);
    }

    const prompt = `You are a food information expert. Based on the following product data from a barcode scan, generate a structured food item record.

PRODUCT DATA:
- Name: ${extractedInfo.name}
- Brand: ${extractedInfo.brand || 'Unknown'}
- Categories: ${extractedInfo.categories.join(', ') || 'Unknown'}
- Food Group Hints: ${extractedInfo.foodGroupHints.join(', ') || 'None'}
- Quantity: ${extractedInfo.quantity || 'Unknown'}
- Serving Size: ${extractedInfo.servingSize || 'Unknown'}
- Ingredients: ${extractedInfo.ingredients || 'Unknown'}
- Labels: ${extractedInfo.labels.join(', ') || 'None'}
- Packaging: ${extractedInfo.packaging.join(', ') || 'Unknown'}
- Nutri-Score: ${extractedInfo.nutriscoreGrade || 'Unknown'}
- NOVA Group: ${extractedInfo.novaGroup || 'Unknown'}
- Keywords: ${extractedInfo.keywords.join(', ') || 'None'}

Generate a JSON response with this EXACT structure:
{
  "name": "string (specific food item name, use the product name or improve it to be more descriptive)",
  "foodGroup": "string (one of: ${FOOD_GROUP_ENUM_STRING})",
  "notes": "string (include brand, quantity, and any relevant details like organic, vegan, etc.)",
  "typicalShelfLifeDays_Pantry": number (typical shelf life in days when stored in pantry, 0 if not applicable or requires refrigeration),
  "typicalShelfLifeDays_Fridge": number (typical shelf life in days when stored in fridge, 0 if not applicable),
  "typicalShelfLifeDays_Freezer": number (typical shelf life in days when stored in freezer, 0 if not applicable),
  "unitType": "string (one of: ${UNIT_TYPE_ENUM_STRING})"
}

Rules:
- Choose the most appropriate foodGroup based on the categories and ingredients
- For processed/packaged foods, consider them in their unopened state for pantry shelf life
- After opening, use fridge shelf life estimates
- unitType should be based on how the product is typically measured:
  - "Weight" for products sold by weight (grams, kg, oz, lb)
  - "Volume" for liquids (ml, L, fl oz)
  - "Count" for individual items or pieces
- If foodGroup is "MixedDishes", unitType MUST be "Count"
- Include the brand in notes if available
- Return ONLY valid JSON, no additional text or explanation`;

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text()?.trim();

      if (!text) {
        this.logger.warn('Gemini returned empty response, using basic result');
        return this.createBasicResultFromProductInfo(extractedInfo);
      }

      // Clean up markdown code blocks if present
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const parsed = JSON.parse(text) as FoodScanResult;

      // Validate and enforce rules
      return {
        name: parsed.name || extractedInfo.name,
        foodGroup: parsed.foodGroup || 'Other',
        notes: parsed.notes || '',
        typicalShelfLifeDays_Pantry: parsed.typicalShelfLifeDays_Pantry ?? 0,
        typicalShelfLifeDays_Fridge: parsed.typicalShelfLifeDays_Fridge ?? 0,
        typicalShelfLifeDays_Freezer: parsed.typicalShelfLifeDays_Freezer ?? 0,
        unitType:
          parsed.foodGroup === 'MixedDishes'
            ? 'Count'
            : parsed.unitType || 'Count',
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Gemini barcode normalization failed: ${err.message}`);
      return this.createBasicResultFromProductInfo(extractedInfo);
    }
  }

  createBasicResultFromProductInfo(
    extractedInfo: ExtractedProductInfo,
  ): FoodScanResult {
    // Determine food group from categories heuristically
    const foodGroup = this.inferFoodGroup(extractedInfo);

    // Determine unit type from packaging and quantity
    const unitType = this.inferUnitType(extractedInfo);

    // Build notes
    const notesParts: string[] = [];
    if (extractedInfo.brand) notesParts.push(`Brand: ${extractedInfo.brand}`);
    if (extractedInfo.quantity)
      notesParts.push(`Quantity: ${extractedInfo.quantity}`);
    if (extractedInfo.labels.length > 0)
      notesParts.push(`Labels: ${extractedInfo.labels.slice(0, 3).join(', ')}`);

    return {
      name: extractedInfo.name,
      foodGroup,
      notes: notesParts.join('. ') || 'Scanned from barcode',
      typicalShelfLifeDays_Pantry: this.inferPantryShelfLife(foodGroup),
      typicalShelfLifeDays_Fridge: this.inferFridgeShelfLife(foodGroup),
      typicalShelfLifeDays_Freezer: this.inferFreezerShelfLife(foodGroup),
      unitType: foodGroup === 'MixedDishes' ? 'Count' : unitType,
    };
  }

  private inferFoodGroup(extractedInfo: ExtractedProductInfo): string {
    const allText = [
      ...extractedInfo.categories,
      ...extractedInfo.foodGroupHints,
      ...extractedInfo.keywords,
      extractedInfo.name,
    ]
      .join(' ')
      .toLowerCase();

    // Simple heuristic matching
    if (/milk|cheese|yogurt|butter|cream|dairy/.test(allText)) return 'Dairy';
    if (/meat|beef|pork|chicken|turkey|lamb|sausage|bacon/.test(allText))
      return 'Meat';
    if (/fish|salmon|tuna|shrimp|seafood|shellfish/.test(allText))
      return 'Seafood';
    if (/fruit|apple|banana|orange|berry|grape/.test(allText)) return 'Fruits';
    if (/vegetable|carrot|tomato|potato|onion|lettuce|broccoli/.test(allText))
      return 'Vegetables';
    if (/bread|pasta|rice|cereal|grain|wheat|oat|flour/.test(allText))
      return 'Grains';
    if (/egg/.test(allText)) return 'Eggs';
    if (/nut|almond|peanut|walnut|seed/.test(allText)) return 'NutsAndSeeds';
    if (/oil|olive|coconut oil|vegetable oil/.test(allText))
      return 'OilsAndFats';
    if (/bean|lentil|chickpea|tofu|legume/.test(allText)) return 'Legumes';
    if (/juice|soda|water|beverage|drink|coffee|tea/.test(allText))
      return 'Beverages';
    if (/spice|herb|seasoning|salt|pepper/.test(allText))
      return 'SpicesAndHerbs';
    if (/sauce|condiment|ketchup|mustard|mayonnaise|dressing/.test(allText))
      return 'CondimentsAndSauces';
    if (/snack|chip|cracker|cookie|candy|chocolate/.test(allText))
      return 'Snacks';
    if (/frozen|ice cream/.test(allText)) return 'FrozenFoods';
    if (/canned|preserved/.test(allText)) return 'CannedGoods';
    if (/baby|infant/.test(allText)) return 'BabyFood';
    if (/ready|meal|prepared|dish/.test(allText)) return 'MixedDishes';

    return 'Other';
  }

  private inferUnitType(extractedInfo: ExtractedProductInfo): string {
    const quantityText = (extractedInfo.quantity || '').toLowerCase();
    const packagingText = extractedInfo.packaging.join(' ').toLowerCase();

    // Check for volume indicators
    if (/ml|l\b|liter|litre|fl oz|fluid|gallon|pint/.test(quantityText)) {
      return 'Volume';
    }

    // Check for weight indicators
    if (/g\b|kg|gram|oz|lb|pound/.test(quantityText)) {
      return 'Weight';
    }

    // Check packaging for hints
    if (/bottle|can|carton|jug/.test(packagingText)) {
      return 'Volume';
    }

    if (/bag|box|pack|piece|unit/.test(packagingText)) {
      return 'Count';
    }

    return 'Count'; // Default
  }

  private inferPantryShelfLife(foodGroup: string): number {
    const shelfLifeMap: Record<string, number> = {
      Grains: 180,
      CannedGoods: 730,
      SpicesAndHerbs: 365,
      CondimentsAndSauces: 365,
      Snacks: 90,
      NutsAndSeeds: 180,
      OilsAndFats: 180,
      Beverages: 365,
      Other: 90,
    };
    return shelfLifeMap[foodGroup] || 0;
  }

  private inferFridgeShelfLife(foodGroup: string): number {
    const shelfLifeMap: Record<string, number> = {
      Dairy: 14,
      Meat: 5,
      Seafood: 3,
      Eggs: 35,
      Fruits: 7,
      Vegetables: 7,
      MixedDishes: 5,
      CondimentsAndSauces: 90,
      Beverages: 14,
      Other: 7,
    };
    return shelfLifeMap[foodGroup] || 7;
  }

  private inferFreezerShelfLife(foodGroup: string): number {
    const shelfLifeMap: Record<string, number> = {
      Meat: 180,
      Seafood: 90,
      Dairy: 90,
      Fruits: 240,
      Vegetables: 240,
      MixedDishes: 90,
      Grains: 180,
      FrozenFoods: 180,
      Other: 90,
    };
    return shelfLifeMap[foodGroup] || 90;
  }
}

