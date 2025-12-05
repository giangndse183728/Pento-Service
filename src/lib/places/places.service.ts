import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { FoodGroup } from 'src/common/constants/food-group.enum';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const fetch: any;

export const FoodGroupKeywordMap: Record<FoodGroup, string[]> = {
  Meat: ['cửa hàng thịt', 'tiệm thịt', 'chợ thịt', 'siêu thị'],
  Seafood: ['hải sản', 'cửa hàng hải sản', 'chợ cá'],
  FruitsVegetables: [
    'cửa hàng trái cây',
    'trái cây',
    'rau củ',
    'cửa hàng rau củ',
  ],
  Dairy: ['sữa', 'cửa hàng sữa', 'sản phẩm từ sữa', 'siêu thị'],
  CerealGrainsPasta: [
    'tạp hóa',
    'cửa hàng tạp hóa',
    'siêu thị',
    'gạo',
    'mì pasta',
  ],
  LegumesNutsSeeds: ['hạt dinh dưỡng', 'cửa hàng hạt', 'organic', 'hạt điều'],
  FatsOils: ['dầu ăn', 'siêu thị', 'tạp hóa'],
  Confectionery: ['bánh kẹo', 'tiệm bánh', 'cửa hàng kẹo'],
  Beverages: ['đồ uống', 'cửa hàng đồ uống', 'tạp hóa', 'siêu thị'],
  Condiments: ['gia vị', 'nước chấm', 'siêu thị', 'tạp hóa'],
  MixedDishes: ['nhà hàng', 'quán ăn', 'đồ ăn mang đi'],
};

export interface NearbyPlace {
  placeId: string;
  name: string;
  address?: string;
  location: {
    lat: number;
    lng: number;
  };
  rating?: number;
  userRatingsTotal?: number;
  types?: string[];
  vicinity?: string;
}

/**
 * Google Places API service - handles direct API calls to Google Places.
 * This is a library service that should not contain business logic like quota checking.
 */
@Injectable()
export class GooglePlacesService {
  private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY;
  private readonly baseUrl =
    'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

  constructor() {
    if (!this.apiKey) {
      throw new Error(
        'GOOGLE_PLACES_API_KEY is not set. Please configure it in your environment.',
      );
    }
  }

  /**
   * Search nearby places using Google Places API.
   * Pure API call without any business logic.
   */
  async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    keyword: string,
  ): Promise<NearbyPlace[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('location', `${latitude},${longitude}`);
    url.searchParams.set('radius', radiusMeters.toString());
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('key', this.apiKey!);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Google Places API responded with status ${response.status}`,
      );
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(
        `Google Places API error: ${data.status} - ${data.error_message || ''}`,
      );
    }

    if (!Array.isArray(data.results)) {
      return [];
    }

    return data.results.map(
      (result: any): NearbyPlace => ({
        placeId: result.place_id,
        name: result.name,
        address: result.vicinity ?? result.formatted_address,
        location: {
          lat: result.geometry?.location?.lat,
          lng: result.geometry?.location?.lng,
        },
        rating: result.rating,
        userRatingsTotal: result.user_ratings_total,
        types: result.types,
        vicinity: result.vicinity,
      }),
    );
  }

  /**
   * Get keywords for a food group.
   * This is a utility method to map food groups to search keywords.
   */
  getKeywordsForFoodGroup(foodGroup: FoodGroup): string[] {
    return FoodGroupKeywordMap[foodGroup] || [];
  }
}


