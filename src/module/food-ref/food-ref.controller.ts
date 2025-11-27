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
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Sorting strategy. Use "newest" for latest entries, default alphabetical.',
    schema: { enum: ['alpha', 'newest'] },
  })
  findAll(@Query('sort') sort?: 'alpha' | 'newest') {
    return this.foodRefService.findAll(sort);
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

