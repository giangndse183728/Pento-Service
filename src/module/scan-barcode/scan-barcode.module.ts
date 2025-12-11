import { Module } from '@nestjs/common';
import { ScanBarcodeController } from './scan-barcode.controller';
import { ScanBarcodeService } from './scan-barcode.service';
import { AiScanService } from '../../lib/ai/ai-scan.service';
import { ImageSearchService } from '../../lib/image-search/image-search.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [ScanBarcodeController],
  providers: [ScanBarcodeService, AiScanService, ImageSearchService],
  imports: [AuthModule],
})
export class ScanBarcodeModule {}

