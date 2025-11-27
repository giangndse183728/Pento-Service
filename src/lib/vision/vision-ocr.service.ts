import { Injectable, Logger } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';

@Injectable()
export class VisionOcrService {
  private readonly logger = new Logger(VisionOcrService.name);
  private readonly client: ImageAnnotatorClient;

  constructor() {
    const rawCredentials = process.env.GOOGLE_VISION_CREDENTIALS;
    if (rawCredentials) {
      this.logger.log('Initializing Google Vision with explicit credentials');
      const credentials = JSON.parse(rawCredentials);
      this.client = new ImageAnnotatorClient({ credentials });
    } else {
      this.logger.log(
        'Initializing Google Vision using default application credentials',
      );
      this.client = new ImageAnnotatorClient();
    }
  }

  async extractText(imageBuffer: Buffer): Promise<string> {
    try {
      const [result] = await this.client.documentTextDetection({
        image: { content: imageBuffer },
      });

      const text = result.fullTextAnnotation?.text?.trim();
      if (!text) {
        throw new Error('No text detected in the provided image');
      }

      return text;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Google Vision OCR failed', err?.stack);
      throw new Error(
        `Vision OCR failed: ${err?.message ?? 'Unknown error occurred'}`,
      );
    }
  }
}

