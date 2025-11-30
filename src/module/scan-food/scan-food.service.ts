import { Injectable, Logger } from '@nestjs/common';
import { AiScanService, FoodScanResult } from '../../lib/ai/ai-scan.service';
import { ImageSearchService } from '../../lib/image-search/image-search.service';
import { PrismaService } from '../../lib/prisma/prisma.service';
import {
  FoodItemDto,
  ScanFoodResponseDto,
} from './dto/scan-food-response.dto';
import { randomUUID } from 'crypto';
import { VisionOcrService } from '../../lib/vision/vision-ocr.service';
import { Prisma, food_references } from '@prisma/client';
import Fuse from 'fuse.js';

@Injectable()
export class ScanFoodService {
  private readonly logger = new Logger(ScanFoodService.name);
  private readonly fuseThreshold = 0.6;

  constructor(
    private readonly aiScanService: AiScanService,
    private readonly imageSearchService: ImageSearchService,
    private readonly prismaService: PrismaService,
    private readonly visionOcrService: VisionOcrService,
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

      // Step 3: Create or reuse food references in database
      this.logger.log('Creating or reusing food references in database...');
      const { items, createdIds } = await this.createBulkFoodReferences(
        scanResults,
        imageResults,
      );

      return {
        success: true,
        items,
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

  async scanBillAndCreateFoodReferences(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ScanFoodResponseDto> {
    try {
      this.logger.log('Running Google Vision OCR on receipt image...');
      const ocrText = await this.visionOcrService.extractText(imageBuffer);

      this.logger.log('Generating structured items from OCR text via Gemini...');
      const scanResults =
        await this.aiScanService.generateFoodItemsFromReceipt(ocrText);

      if (!scanResults.length) {
        return {
          success: false,
          items: [],
          createdIds: [],
          error: 'No food items could be extracted from the receipt',
        };
      }

      const foodNames = scanResults.map((r) => r.name);
      const imageResults =
        await this.imageSearchService.searchMultipleFoodImages(foodNames);

      const { items, createdIds } = await this.createBulkFoodReferences(
        scanResults,
        imageResults,
      );

      return {
        success: true,
        items,
        createdIds,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('Scan food bill failed', err?.stack);
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
    imageResults: Map<
      string,
      { imageUrl: string | null; title: string | null }
    >,
  ): Promise<{ createdIds: string[]; items: FoodItemDto[] }> {
    // Build index once for the entire batch to avoid rebuilding N times
    const foodRefIndex = await this.buildFoodReferenceIndex();

    const now = new Date();
    const createdIds: string[] = [];
    const items: FoodItemDto[] = [];
    const recordsToCreate: Prisma.food_referencesCreateManyInput[] = [];

    for (const result of scanResults) {
      const imageUrl = imageResults.get(result.name)?.imageUrl || null;
      const existing = await this.findExistingFoodReferenceWithIndex(
        result.name,
        foodRefIndex,
      );

      if (existing) {
        items.push({
          name: existing.name,
          foodGroup: existing.food_group,
          notes: result.notes,
          typicalShelfLifeDays_Pantry: existing.typical_shelf_life_days_pantry,
          typicalShelfLifeDays_Fridge: existing.typical_shelf_life_days_fridge,
          typicalShelfLifeDays_Freezer: existing.typical_shelf_life_days_freezer,
          unitType: existing.unit_type,
          imageUrl: existing.image_url ?? imageUrl,
          referenceId: existing.id,
          isExistingReference: true,
        });
        continue;
      }

      const id = randomUUID();
      createdIds.push(id);

      const record: Prisma.food_referencesCreateManyInput = {
        id,
        name: result.name,
        food_group: result.foodGroup,
        usda_id: `AI-SCAN-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}`,
        typical_shelf_life_days_pantry: result.typicalShelfLifeDays_Pantry,
        typical_shelf_life_days_fridge: result.typicalShelfLifeDays_Fridge,
        typical_shelf_life_days_freezer: result.typicalShelfLifeDays_Freezer,
        unit_type: result.unitType,
        image_url: imageUrl,
        created_on_utc: now,
        updated_on_utc: now,
      };

      recordsToCreate.push(record);

      items.push({
        name: record.name,
        foodGroup: record.food_group,
        notes: result.notes,
        typicalShelfLifeDays_Pantry: record.typical_shelf_life_days_pantry ?? 0,
        typicalShelfLifeDays_Fridge: record.typical_shelf_life_days_fridge ?? 0,
        typicalShelfLifeDays_Freezer:
          record.typical_shelf_life_days_freezer ?? 0,
        unitType: record.unit_type ?? result.unitType,
        imageUrl: record.image_url || null,
        referenceId: id,
        isExistingReference: false,
      });
    }

    if (recordsToCreate.length) {
      await this.prismaService.food_references.createMany({
        data: recordsToCreate,
      });
      this.logger.log(`Created ${recordsToCreate.length} new food references`);
      // Rebuild index after createMany to ensure it's up-to-date
      await this.rebuildFoodReferenceIndex();
    } else {
      this.logger.log('All scanned items matched existing food references');
    }

    return { createdIds, items };
  }

  private async buildFoodReferenceIndex(): Promise<Fuse<FoodReferenceCandidate>> {
    const references = await this.prismaService.food_references.findMany({
      where: {
        is_deleted: false,
      },
      select: {
        id: true,
        name: true,
        food_group: true,
        typical_shelf_life_days_pantry: true,
        typical_shelf_life_days_fridge: true,
        typical_shelf_life_days_freezer: true,
        unit_type: true,
        image_url: true,
      },
    });

    // Normalize names in the index for consistent matching
    const normalizedReferences = references.map((ref) => ({
      ...ref,
      name: this.normalizeName(ref.name),
    }));

    const index = new Fuse(normalizedReferences, {
      keys: ['name'],
      includeScore: true,
      threshold: this.fuseThreshold,
    });
    this.logger.log(
      `Built food reference index with ${references.length} entries`,
    );
    return index;
  }

  private async rebuildFoodReferenceIndex(): Promise<void> {
    await this.buildFoodReferenceIndex();
  }

  private normalizeName(name: string): string {
    return name.trim().toLowerCase();
  }

  private async findExistingFoodReferenceWithIndex(
    name: string,
    foodRefIndex: Fuse<FoodReferenceCandidate>,
  ): Promise<food_references | null> {
    // Normalize the name before fuzzy matching
    const normalizedName = this.normalizeName(name);

    const [best] = foodRefIndex.search(normalizedName, { limit: 1 });
    if (!best || best.score === undefined || best.score > this.fuseThreshold) {
      return null;
    }

    // Fetch the full record from the database after fuzzy match
    const matchedId = best.item.id;
    const fullRecord = await this.prismaService.food_references.findUnique({
      where: { id: matchedId },
    });

    return fullRecord;
  }
}

type FoodReferenceCandidate = Pick<
  food_references,
  | 'id'
  | 'name'
  | 'food_group'
  | 'typical_shelf_life_days_pantry'
  | 'typical_shelf_life_days_fridge'
  | 'typical_shelf_life_days_freezer'
  | 'unit_type'
  | 'image_url'
>;

