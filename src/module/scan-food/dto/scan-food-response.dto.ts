import { ApiProperty } from '@nestjs/swagger';

export class FoodItemDto {
  @ApiProperty({ description: 'Food item name' })
  name!: string;

  @ApiProperty({ description: 'Food group category' })
  foodGroup!: string;

  @ApiProperty({ description: 'Notes about the food' })
  notes!: string;

  @ApiProperty({ description: 'Shelf life in pantry (days)' })
  typicalShelfLifeDays_Pantry!: number;

  @ApiProperty({ description: 'Shelf life in fridge (days)' })
  typicalShelfLifeDays_Fridge!: number;

  @ApiProperty({ description: 'Shelf life in freezer (days)' })
  typicalShelfLifeDays_Freezer!: number;

  @ApiProperty({ description: 'Unit type (Weight, Count, Volume)' })
  unitType!: string;

  @ApiProperty({ description: 'Image URL from search', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'ID of the food reference (existing or newly created)',
  })
  referenceId!: string;

  @ApiProperty({
    description: 'Indicates if the item reused an existing food reference',
  })
  isExistingReference!: boolean;
}

export class ScanFoodResponseDto {
  @ApiProperty({ description: 'Whether the scan was successful' })
  success!: boolean;

  @ApiProperty({ description: 'Scanned food items', type: [FoodItemDto] })
  items!: FoodItemDto[];

  @ApiProperty({
    description: 'Created food reference IDs',
    type: [String],
  })
  createdIds!: string[];

  @ApiProperty({ description: 'Error message if any', nullable: true })
  error?: string;
}

