import { ApiProperty } from '@nestjs/swagger';

export class ScanBarcodeRequestDto {
  @ApiProperty({
    description: 'Barcode string (EAN-13, UPC-A, etc.)',
    example: '5000112637922',
  })
  barcode!: string;
}

export class BarcodeFoodItemDto {
  @ApiProperty({ description: 'Food item name' })
  name!: string;

  @ApiProperty({ description: 'Food group category' })
  foodGroup!: string;

  @ApiProperty({ description: 'Notes about the food (brand, quantity, labels)' })
  notes!: string;

  @ApiProperty({ description: 'Shelf life in pantry (days)' })
  typicalShelfLifeDays_Pantry!: number;

  @ApiProperty({ description: 'Shelf life in fridge (days)' })
  typicalShelfLifeDays_Fridge!: number;

  @ApiProperty({ description: 'Shelf life in freezer (days)' })
  typicalShelfLifeDays_Freezer!: number;

  @ApiProperty({ description: 'Unit type (Weight, Count, Volume)' })
  unitType!: string;

  @ApiProperty({ description: 'Product image URL from Open Food Facts', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ description: 'The barcode that was scanned' })
  barcode!: string;

  @ApiProperty({
    description: 'ID of the food reference (existing or newly created)',
    required: false,
  })
  referenceId?: string;

  @ApiProperty({
    description: 'Indicates if the item reused an existing food reference',
    required: false,
  })
  isExistingReference?: boolean;
}

export class ScanBarcodeResponseDto {
  @ApiProperty({ description: 'Whether the scan was successful' })
  success!: boolean;

  @ApiProperty({ description: 'Scanned food item data', type: BarcodeFoodItemDto, nullable: true })
  item!: BarcodeFoodItemDto | null;

  @ApiProperty({ description: 'Created food reference ID', nullable: true })
  createdId!: string | null;

  @ApiProperty({ description: 'Error message if any', nullable: true })
  error?: string;
}

