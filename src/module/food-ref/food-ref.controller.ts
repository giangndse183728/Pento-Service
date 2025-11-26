import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FoodRefService } from './food-ref.service';

@ApiTags('food-ref')
@Controller('food-ref')
export class FoodRefController {
  constructor(private readonly foodRefService: FoodRefService) {}

  @Get()
  @ApiOperation({ summary: 'Get all food references' })
  @ApiResponse({ status: 200, description: 'List of food references' })
  findAll() {
    return this.foodRefService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search food references by name, barcode, or brand' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiResponse({ status: 200, description: 'Search results' })
  search(@Query('q') query: string) {
    if (!query?.trim()) {
      return [];
    }
    return this.foodRefService.search(query);
  }

}

