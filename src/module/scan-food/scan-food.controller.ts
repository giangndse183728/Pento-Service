import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ScanFoodService } from './scan-food.service';
import { ScanFoodResponseDto } from './dto/scan-food-response.dto';
import { WithKeycloakAuth } from '../auth/decorators/keycloak-auth.decorator';

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
  @WithKeycloakAuth()
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Scan food image and create food references',
    description:
      'Upload a food image to be analyzed by Gemini AI. Detected food items will be saved to food_references.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'userId',
    required: true,
    description: 'User ID',
    type: String,
  })
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
    @Query('userId') userId: string,
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
      userId,
    );
  }

  @Post('bill')
  @WithKeycloakAuth()
  @UseInterceptors(FileInterceptor('billImage'))
  @ApiOperation({
    summary: 'Scan grocery bill and create food references',
    description:
      'Upload a grocery bill image. Google Vision OCR extracts the text, Gemini structures items, and they are saved as food references.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'userId',
    required: true,
    description: 'User ID',
    type: String,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        billImage: {
          type: 'string',
          format: 'binary',
          description: 'Receipt/bill image file (JPEG, PNG, WebP, GIF)',
        },
      },
      required: ['billImage'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Receipt scan results with created references',
    type: ScanFoodResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or unsupported image format',
  })
  async scanFoodBill(
    @UploadedFile() file: Express.Multer.File,
    @Query('userId') userId: string,
  ): Promise<ScanFoodResponseDto> {
    if (!file) {
      throw new BadRequestException('Bill image file is required');
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

    return this.scanFoodService.scanBillAndCreateFoodReferences(
      file.buffer,
      file.mimetype,
      userId,
    );
  }
}

