import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FoodGroup } from '../../common/constants/food-group.enum';
import { PrismaService } from '../../lib/prisma/prisma.service';
import {
  GooglePlacesService,
  NearbyPlace,
} from '../../lib/places/places.service';


@Injectable()
export class PlacesService {
  constructor(
    private readonly googlePlacesService: GooglePlacesService,
    private readonly prismaService: PrismaService,
  ) {}

  async getNearbyPlacesByFoodGroup(
    foodGroup: FoodGroup,
    latitude: number,
    longitude: number,
    radiusMeters = 2000,
    userId?: string,
  ): Promise<NearbyPlace[]> {
    await this.ensureEntitlementAvailable('GROCERY_MAP', userId);

    const keywords = this.googlePlacesService.getKeywordsForFoodGroup(foodGroup);

    if (!keywords || keywords.length === 0) {
      return [];
    }

    const combinedKeyword = keywords.join('|');

    try {
      const results = await this.googlePlacesService.searchNearbyPlaces(
        latitude,
        longitude,
        radiusMeters,
        combinedKeyword,
      );

      await this.incrementUsage('GROCERY_MAP', userId);

      return results;
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch nearby places from Google Places API',
      );
    }
  }


  private async ensureEntitlementAvailable(
    featureCode: string,
    userId?: string,
  ): Promise<void> {
    if (!userId) {
      throw new ForbiddenException('User context is required');
    }

    const entitlement = await this.prismaService.user_entitlements.findFirst({
      where: {
        user_id: userId,
        feature_code: featureCode,
      },
    });

    if (!entitlement) {
      throw new ForbiddenException('Feature not available for this user');
    }

    const { quota, usage_count } = entitlement;

    if (quota !== null && quota !== undefined && usage_count >= quota) {
      throw new ForbiddenException(
        `Quota exceeded for feature ${featureCode}. Usage: ${usage_count}/${quota}`,
      );
    }
  }

  private async incrementUsage(
    featureCode: string,
    userId?: string,
  ): Promise<void> {
    if (!userId) return;

    await this.prismaService.user_entitlements.updateMany({
      where: {
        user_id: userId,
        feature_code: featureCode,
      },
      data: {
        usage_count: { increment: 1 },
      },
    });
  }
}

