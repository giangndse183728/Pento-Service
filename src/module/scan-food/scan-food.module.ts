import { Module } from '@nestjs/common';
import { ScanFoodController } from './scan-food.controller';
import { ScanFoodService } from './scan-food.service';
import { AiScanService } from '../../lib/ai/ai-scan.service';
import { ImageSearchService } from '../../lib/image-search/image-search.service';
import { VisionOcrService } from '../../lib/vision/vision-ocr.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [ScanFoodController],
  providers: [
    ScanFoodService,
    AiScanService,
    ImageSearchService,
    VisionOcrService,
  ],
  imports: [AuthModule],
})
export class ScanFoodModule {}

