import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ScanFoodService } from './scan-food.service';
import { ScanFoodResponseDto } from './dto/scan-food-response.dto';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@ApiTags('scan-food')
@Controller('scan-food')
export class ScanFoodController {
  constructor(private readonly scanFoodService: ScanFoodService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Scan food image and create food references',
    description:
      'Upload a food image to be analyzed by Gemini AI. Detected food items will be saved to food_references.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Food image file (JPEG, PNG, WebP, GIF)',
        },
      },
      required: ['image'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Food scan results with created references',
    type: ScanFoodResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or unsupported image format',
  })
  async scanFood(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ScanFoodResponseDto> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported image format. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    return this.scanFoodService.scanAndCreateFoodReferences(
      file.buffer,
      file.mimetype,
    );
  }
}

