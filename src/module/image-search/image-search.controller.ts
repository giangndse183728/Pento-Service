import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ImageSearchService,
  ImageSearchResult,
  ImageSearchItem,
} from '../../lib/image-search/image-search.service';

@ApiTags('image-search')
@Controller('image-search')
export class ImageSearchController {
  constructor(private readonly imageSearchService: ImageSearchService) {}

  @Get('food')
  @ApiOperation({ summary: 'Search for food image by name' })
  @ApiQuery({ name: 'q', description: 'Food name to search', required: true })
  @ApiResponse({
    status: 200,
    description: 'Food image search result',
    schema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', nullable: true },
        title: { type: 'string', nullable: true },
      },
    },
  })
  async searchFood(@Query('q') query: string): Promise<ImageSearchResult> {
    if (!query?.trim()) {
      return { imageUrl: null, title: null };
    }
    return this.imageSearchService.searchFoodImage(query);
  }

  @Get()
  @ApiOperation({ summary: 'General image search' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiQuery({
    name: 'num',
    description: 'Number of results (1-10, default: 1)',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Image search results',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          imageUrl: { type: 'string' },
          title: { type: 'string' },
        },
      },
    },
  })
  async search(
    @Query('q') query: string,
    @Query('num') num?: string,
  ): Promise<ImageSearchItem[]> {
    if (!query?.trim()) {
      return [];
    }
    const numResults = num ? parseInt(num, 10) : 1;
    return this.imageSearchService.searchImage(query, numResults);
  }
}

