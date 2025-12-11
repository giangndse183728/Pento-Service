import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ScanBarcodeService } from './scan-barcode.service';
import {
  ScanBarcodeRequestDto,
  ScanBarcodeResponseDto,
} from './dto/scan-barcode.dto';
import { WithKeycloakAuth } from '../auth/decorators/keycloak-auth.decorator';

@ApiTags('scan-barcode')
@Controller('scan-barcode')
export class ScanBarcodeController {
  constructor(private readonly scanBarcodeService: ScanBarcodeService) {}

  @Post()
  @WithKeycloakAuth()
  @ApiOperation({
    summary: 'Scan barcode and get food information',
    description:
      'Submit a barcode string to fetch product data from Open Food Facts and normalize it using AI. The result will be saved as a food reference.',
  })
  @ApiBody({
    type: ScanBarcodeRequestDto,
    description: 'Barcode to scan',
  })
  @ApiResponse({
    status: 200,
    description: 'Barcode scan results with created reference',
    type: ScanBarcodeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid barcode format',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found in Open Food Facts database',
  })
  async scanBarcode(
    @Body() body: ScanBarcodeRequestDto,
  ): Promise<ScanBarcodeResponseDto> {
    const { barcode } = body;

    if (!barcode || !barcode.trim()) {
      throw new BadRequestException('Barcode is required');
    }

    // Validate barcode format (basic validation for common formats)
    const cleanBarcode = barcode.trim().replace(/\s/g, '');
    if (!/^\d{8,14}$/.test(cleanBarcode)) {
      throw new BadRequestException(
        'Invalid barcode format. Expected 8-14 digit numeric barcode (EAN-8, EAN-13, UPC-A, etc.)',
      );
    }

    return this.scanBarcodeService.scanBarcodeAndCreateReference(cleanBarcode);
  }
}
