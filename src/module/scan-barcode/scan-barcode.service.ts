import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { food_references } from '@prisma/client';
import {
  AiScanService,
  ExtractedProductInfo,
  FoodScanResult,
} from '../../lib/ai/ai-scan.service';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { ImageSearchService } from '../../lib/image-search/image-search.service';
import {
  BarcodeFoodItemDto,
  ScanBarcodeResponseDto,
} from './dto/scan-barcode.dto';

export interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  generic_name_en?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  categories_hierarchy?: string[];
  food_groups?: string;
  food_groups_tags?: string[];
  ingredients_text?: string;
  ingredients_text_en?: string;
  nutriments?: Record<string, unknown>;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number;
  product_quantity?: number;
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  image_small_url?: string;
  labels?: string;
  labels_tags?: string[];
  packaging?: string;
  packaging_tags?: string[];
  stores?: string;
  countries?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  ecoscore_grade?: string;
  abbreviated_product_name?: string;
  product_name_fr?: string;
  product_name_de?: string;
  product_name_es?: string;
  product_name_it?: string;
  product_name_pt?: string;
  product_name_nl?: string;
  product_name_pl?: string;
  product_name_ru?: string;
  product_name_ja?: string;
  product_name_zh?: string;
  product_name_ko?: string;
  product_name_ar?: string;
  product_name_vi?: string;
  generic_name_fr?: string;
  generic_name_de?: string;
  _keywords?: string[];
  [key: string]: unknown;
}

export interface OpenFoodFactsResponse {
  status: number;
  status_verbose: string;
  code: string;
  product?: OpenFoodFactsProduct;
}

@Injectable()
export class ScanBarcodeService {
  private readonly logger = new Logger(ScanBarcodeService.name);
  private readonly openFoodFactsBaseUrl =
    'https://world.openfoodfacts.org/api/v2/product';

  constructor(
    private readonly aiScanService: AiScanService,
    private readonly prismaService: PrismaService,
    private readonly imageSearchService: ImageSearchService,
  ) {}

  async scanBarcodeAndCreateReference(
    barcode: string,
  ): Promise<ScanBarcodeResponseDto> {
    try {
      // Step 1: Check if food reference already exists with this barcode
      const existingByBarcode = await this.findFoodReferenceByBarcode(barcode);

      if (existingByBarcode) {
        this.logger.log(
          `Found existing food reference for barcode ${barcode}: ${existingByBarcode.name}`,
        );

        return {
          success: true,
          item: this.mapFoodReferenceToDto(existingByBarcode, barcode),
          createdId: null,
        };
      }

      // Step 2: Fetch from Open Food Facts + normalize with Gemini
      const scanResult = await this.fetchAndNormalizeBarcode(barcode);

      // Step 3: Search for image if Open Food Facts didn't provide one
      let finalImageUrl = scanResult.imageUrl;
      if (!finalImageUrl) {
        const imageResults =
          await this.imageSearchService.searchMultipleFoodImages([
            scanResult.name,
          ]);
        finalImageUrl = imageResults.get(scanResult.name)?.imageUrl || null;
      }

      // Step 4: Create new food reference
      const referenceId = randomUUID();
      const now = new Date();

      await this.prismaService.food_references.create({
        data: {
          id: referenceId,
          name: scanResult.name,
          food_group: scanResult.foodGroup,
          barcode,
          usda_id: `BARCODE-${barcode}`,
          typical_shelf_life_days_pantry: scanResult.typicalShelfLifeDays_Pantry,
          typical_shelf_life_days_fridge: scanResult.typicalShelfLifeDays_Fridge,
          typical_shelf_life_days_freezer: scanResult.typicalShelfLifeDays_Freezer,
          unit_type: scanResult.unitType,
          image_url: finalImageUrl,
          created_on_utc: now,
          updated_on_utc: now,
        },
      });

      this.logger.log(`Created new food reference: ${scanResult.name}`);

      const item: BarcodeFoodItemDto = {
        name: scanResult.name,
        foodGroup: scanResult.foodGroup,
        notes: scanResult.notes,
        typicalShelfLifeDays_Pantry: scanResult.typicalShelfLifeDays_Pantry,
        typicalShelfLifeDays_Fridge: scanResult.typicalShelfLifeDays_Fridge,
        typicalShelfLifeDays_Freezer: scanResult.typicalShelfLifeDays_Freezer,
        unitType: scanResult.unitType,
        imageUrl: finalImageUrl || null,
        barcode,
        referenceId,
        isExistingReference: false,
      };

      return {
        success: true,
        item,
        createdId: referenceId,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Barcode scan failed: ${err.message}`, err.stack);

      if (err.name === 'NotFoundException') {
        throw error;
      }

      return {
        success: false,
        item: null,
        createdId: null,
        error: err.message || 'Unknown error occurred',
      };
    }
  }

  private mapFoodReferenceToDto(
    ref: food_references,
    barcode: string,
  ): BarcodeFoodItemDto {
    return {
      name: ref.name,
      foodGroup: ref.food_group,
      notes: ref.brand ? `Brand: ${ref.brand}` : '',
      typicalShelfLifeDays_Pantry: ref.typical_shelf_life_days_pantry,
      typicalShelfLifeDays_Fridge: ref.typical_shelf_life_days_fridge,
      typicalShelfLifeDays_Freezer: ref.typical_shelf_life_days_freezer,
      unitType: ref.unit_type,
      imageUrl: ref.image_url || null,
      barcode,
      referenceId: ref.id,
      isExistingReference: true,
    };
  }

  private async findFoodReferenceByBarcode(
    barcode: string,
  ): Promise<food_references | null> {
    return this.prismaService.food_references.findFirst({
      where: {
        barcode,
        is_deleted: false,
      },
    });
  }

  private async fetchAndNormalizeBarcode(
    barcode: string,
  ): Promise<FoodScanResult & { imageUrl: string | null }> {
    this.logger.log(`Fetching product data for barcode: ${barcode}`);
    const productData = await this.fetchOpenFoodFactsData(barcode);

    if (!productData) {
      throw new NotFoundException(`Product not found for barcode: ${barcode}`);
    }

    const extractedInfo = this.extractProductInfo(productData);
    this.logger.log(
      `Extracted product info: ${extractedInfo.name || 'Unknown'}`,
    );

    const foodScanResult =
      await this.aiScanService.normalizeProductDataFromBarcode(extractedInfo);

    const imageUrl = this.getBestImageUrl(productData);

    return {
      ...foodScanResult,
      imageUrl,
    };
  }

  private async fetchOpenFoodFactsData(
    barcode: string,
  ): Promise<OpenFoodFactsProduct | null> {
    try {
      const url = `${this.openFoodFactsBaseUrl}/${barcode}.json`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PentoService/1.0 - Food tracking app',
        },
      });

      if (!response.ok) {
        this.logger.warn(
          `Open Food Facts API returned status ${response.status} for barcode ${barcode}`,
        );
        return null;
      }

      const data: OpenFoodFactsResponse = await response.json();

      if (data.status !== 1 || !data.product) {
        this.logger.warn(
          `Product not found in Open Food Facts for barcode ${barcode}`,
        );
        return null;
      }

      return data.product;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to fetch from Open Food Facts: ${err.message}`);
      return null;
    }
  }

  private extractProductInfo(
    product: OpenFoodFactsProduct,
  ): ExtractedProductInfo {
    return {
      name: this.getProductName(product),
      brand: product.brands || null,
      categories: this.getCategories(product),
      foodGroupHints: this.getFoodGroupHints(product),
      quantity: product.quantity || null,
      servingSize: product.serving_size || null,
      servingQuantity: product.serving_quantity || null,
      productQuantity: product.product_quantity || null,
      ingredients: this.getIngredients(product),
      labels: this.getLabels(product),
      packaging: this.getPackaging(product),
      nutriments: product.nutriments || null,
      nutriscoreGrade: product.nutriscore_grade || null,
      novaGroup: product.nova_group || null,
      ecoscoreGrade: product.ecoscore_grade || null,
      keywords: product._keywords || [],
    };
  }

  private getProductName(product: OpenFoodFactsProduct): string {
    const nameFields = [
      product.product_name,
      product.product_name_en,
      product.generic_name,
      product.generic_name_en,
      product.abbreviated_product_name,
      product.product_name_fr,
      product.product_name_de,
      product.product_name_es,
      product.product_name_it,
      product.product_name_pt,
      product.product_name_nl,
      product.product_name_vi,
      product.generic_name_fr,
      product.generic_name_de,
    ];

    for (const name of nameFields) {
      if (name && name.trim()) {
        return name.trim();
      }
    }

    if (product.brands && product.categories) {
      const category = product.categories.split(',')[0]?.trim();
      if (category) {
        return `${product.brands} ${category}`;
      }
    }

    if (product._keywords && product._keywords.length > 0) {
      return product._keywords.slice(0, 3).join(' ');
    }

    return 'Unknown Product';
  }

  private getCategories(product: OpenFoodFactsProduct): string[] {
    const categories: string[] = [];

    if (product.categories) {
      categories.push(
        ...product.categories
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      );
    }

    if (product.categories_tags) {
      categories.push(
        ...product.categories_tags.map((c) =>
          c.replace(/^en:/, '').replace(/-/g, ' '),
        ),
      );
    }

    if (product.categories_hierarchy) {
      categories.push(
        ...product.categories_hierarchy.map((c) =>
          c.replace(/^en:/, '').replace(/-/g, ' '),
        ),
      );
    }

    return [...new Set(categories)];
  }

  private getFoodGroupHints(product: OpenFoodFactsProduct): string[] {
    const hints: string[] = [];

    if (product.food_groups) {
      hints.push(product.food_groups);
    }

    if (product.food_groups_tags) {
      hints.push(
        ...product.food_groups_tags.map((g) =>
          g.replace(/^en:/, '').replace(/-/g, ' '),
        ),
      );
    }

    return hints;
  }

  private getIngredients(product: OpenFoodFactsProduct): string | null {
    return product.ingredients_text || product.ingredients_text_en || null;
  }

  private getLabels(product: OpenFoodFactsProduct): string[] {
    const labels: string[] = [];

    if (product.labels) {
      labels.push(
        ...product.labels
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
      );
    }

    if (product.labels_tags) {
      labels.push(
        ...product.labels_tags.map((l) =>
          l.replace(/^en:/, '').replace(/-/g, ' '),
        ),
      );
    }

    return [...new Set(labels)];
  }

  private getPackaging(product: OpenFoodFactsProduct): string[] {
    const packaging: string[] = [];

    if (product.packaging) {
      packaging.push(
        ...product.packaging
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
      );
    }

    if (product.packaging_tags) {
      packaging.push(
        ...product.packaging_tags.map((p) =>
          p.replace(/^en:/, '').replace(/-/g, ' '),
        ),
      );
    }

    return [...new Set(packaging)];
  }

  private getBestImageUrl(product: OpenFoodFactsProduct): string | null {
    return (
      product.image_front_url ||
      product.image_url ||
      product.image_front_small_url ||
      product.image_small_url ||
      null
    );
  }
}
