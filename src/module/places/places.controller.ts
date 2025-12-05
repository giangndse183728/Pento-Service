import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlacesService } from './places.service';
import { NearbyPlace } from '../../lib/places/places.service';
import { FoodGroup } from '../../common/constants/food-group.enum';
import { WithKeycloakAuth } from '../auth/decorators/keycloak-auth.decorator';

@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('nearby')
  @WithKeycloakAuth()
  @ApiOperation({
    summary: 'Get nearby food-related places by food group',
    description:
      'Returns nearby shops/supermarkets/restaurants around the given coordinates, mapped from the specified food group.',
  })
  @ApiQuery({
    name: 'foodGroup',
    required: true,
    description: 'Food group name',
    enum: [
      'Meat',
      'Seafood',
      'FruitsVegetables',
      'Dairy',
      'CerealGrainsPasta',
      'LegumesNutsSeeds',
      'FatsOils',
      'Confectionery',
      'Beverages',
      'Condiments',
      'MixedDishes',
    ],
  })
  @ApiQuery({
    name: 'lat',
    required: true,
    description: 'User latitude',
    type: Number,
  })
  @ApiQuery({
    name: 'lng',
    required: true,
    description: 'User longitude',
    type: Number,
  })
  @ApiQuery({
    name: 'radius',
    required: false,
    description: 'Search radius in meters (default 2000)',
    type: Number,
  })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: 'User ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'List of nearby places',
    type: Object,
    isArray: true,
  })
  async getNearbyPlaces(
    @Query('foodGroup') foodGroup: FoodGroup,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('userId') userId: string,
    @Query('radius') radius?: string,
  ): Promise<NearbyPlace[]> {
    const latitude = Number(lat);
    const longitude = Number(lng);
    const radiusMeters = radius ? Number(radius) : 2000;

    return this.placesService.getNearbyPlacesByFoodGroup(
      foodGroup,
      latitude,
      longitude,
      radiusMeters,
      userId,
    );
  }
}


