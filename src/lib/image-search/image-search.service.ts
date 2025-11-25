import { Injectable, Logger } from '@nestjs/common';
import { config as loadEnv } from 'dotenv';

loadEnv();

export interface ImageSearchResult {
  imageUrl: string | null;
  title: string | null;
}

export interface ImageSearchItem {
  imageUrl: string;
  title: string;
}

@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);
  private readonly apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  private readonly searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  async searchFoodImage(foodName: string): Promise<ImageSearchResult> {
    if (!this.apiKey || !this.searchEngineId) {
      this.logger.warn(
        'Google Custom Search API credentials not configured. Returning null image URL.',
      );
      return { imageUrl: null, title: null };
    }

    try {
      const query = encodeURIComponent(`${foodName} food`);
      const url = `https://www.googleapis.com/customsearch/v1?key=${this.apiKey}&cx=${this.searchEngineId}&q=${query}&searchType=image&num=1&safe=active`;

      const response = await fetch(url);

      if (!response.ok) {
        this.logger.error(
          `Google Custom Search API error: ${response.status} ${response.statusText}`,
        );
        return { imageUrl: null, title: null };
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const firstItem = data.items[0];
        return {
          imageUrl: firstItem.link || null,
          title: firstItem.title || null,
        };
      }

      return { imageUrl: null, title: null };
    } catch (error) {
      const err = error as Error;
      this.logger.error('Image search failed', err?.stack);
      return { imageUrl: null, title: null };
    }
  }

  async searchMultipleFoodImages(
    foodNames: string[],
  ): Promise<Map<string, ImageSearchResult>> {
    const results = new Map<string, ImageSearchResult>();

    // Process in parallel with rate limiting consideration
    const promises = foodNames.map(async (name) => {
      const result = await this.searchFoodImage(name);
      results.set(name, result);
    });

    await Promise.all(promises);
    return results;
  }

  async searchImage(
    query: string,
    num: number = 1,
  ): Promise<ImageSearchItem[]> {
    if (!this.apiKey || !this.searchEngineId) {
      this.logger.warn(
        'Google Custom Search API credentials not configured. Returning empty array.',
      );
      return [];
    }

    // Limit num to max 10 (Google API limit)
    const limitNum = Math.min(Math.max(1, num), 10);

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.googleapis.com/customsearch/v1?key=${this.apiKey}&cx=${this.searchEngineId}&q=${encodedQuery}&searchType=image&num=${limitNum}&safe=active`;

      const response = await fetch(url);

      if (!response.ok) {
        this.logger.error(
          `Google Custom Search API error: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        return data.items.map((item: any) => ({
          imageUrl: item.link || '',
          title: item.title || '',
        }));
      }

      return [];
    } catch (error) {
      const err = error as Error;
      this.logger.error('Image search failed', err?.stack);
      return [];
    }
  }
}

