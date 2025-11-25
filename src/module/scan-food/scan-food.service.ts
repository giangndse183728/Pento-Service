import { Injectable, Logger } from '@nestjs/common';
import { AiScanService, FoodScanResult } from '../../lib/ai/ai-scan.service';
import { ImageSearchService } from '../../lib/image-search/image-search.service';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { FoodItemDto, ScanFoodResponseDto } from './dto/scan-food-response.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ScanFoodService {
  private readonly logger = new Logger(ScanFoodService.name);

  constructor(
    private readonly aiScanService: AiScanService,
    private readonly imageSearchService: ImageSearchService,
    private readonly prismaService: PrismaService,
  ) {}

  async scanAndCreateFoodReferences(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ScanFoodResponseDto> {
    try {
      // Step 1: Scan food image with Gemini 2.5 Pro
      this.logger.log('Scanning food image with Gemini AI...');
      const scanResults = await this.aiScanService.scanFoodImage(
        imageBuffer,
        mimeType,
      );

      if (!scanResults || scanResults.length === 0) {
        return {
          success: false,
          items: [],
          createdIds: [],
          error: 'No food items detected in the image',
        };
      }

      // Step 2: Search for images for each food item
      this.logger.log(
        `Searching images for ${scanResults.length} food items...`,
      );
      const foodNames = scanResults.map((r) => r.name);
      const imageResults =
        await this.imageSearchService.searchMultipleFoodImages(foodNames);

      // Step 3: Prepare food items with images
      const foodItems: FoodItemDto[] = scanResults.map((result) => ({
        name: result.name,
        foodGroup: result.foodGroup,
        notes: result.notes,
        typicalShelfLifeDays_Pantry: result.typicalShelfLifeDays_Pantry,
        typicalShelfLifeDays_Fridge: result.typicalShelfLifeDays_Fridge,
        typicalShelfLifeDays_Freezer: result.typicalShelfLifeDays_Freezer,
        unitType: result.unitType,
        imageUrl: imageResults.get(result.name)?.imageUrl || null,
      }));

      // Step 4: Create bulk food_references in database
      this.logger.log('Creating food references in database...');
      const createdIds = await this.createBulkFoodReferences(
        scanResults,
        imageResults,
      );

      return {
        success: true,
        items: foodItems,
        createdIds,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('Scan food failed', err?.stack);
      return {
        success: false,
        items: [],
        createdIds: [],
        error: err?.message ?? 'Unknown error occurred',
      };
    }
  }

  private async createBulkFoodReferences(
    scanResults: FoodScanResult[],
    imageResults: Map<string, { imageUrl: string | null; title: string | null }>,
  ): Promise<string[]> {
    const now = new Date();
    const createdIds: string[] = [];

    const dataToCreate = scanResults.map((result) => {
      const id = randomUUID();
      createdIds.push(id);

      return {
        id,
        name: result.name,
        food_group: result.foodGroup,
        usda_id: `AI-SCAN-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        typical_shelf_life_days_pantry: result.typicalShelfLifeDays_Pantry,
        typical_shelf_life_days_fridge: result.typicalShelfLifeDays_Fridge,
        typical_shelf_life_days_freezer: result.typicalShelfLifeDays_Freezer,
        unit_type: result.unitType,
        image_url: imageResults.get(result.name)?.imageUrl || null,
        created_on_utc: now,
        updated_on_utc: now,
        is_archived: false,
        is_deleted: false,
      };
    });

    await this.prismaService.food_references.createMany({
      data: dataToCreate,
    });

    this.logger.log(`Created ${createdIds.length} food references`);
    return createdIds;
  }
}

