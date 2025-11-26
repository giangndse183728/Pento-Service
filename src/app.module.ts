import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatbotModule } from './module/chatbot/chatbot.module';
import { ScanFoodModule } from './module/scan-food/scan-food.module';
import { FoodRefModule } from './module/food-ref/food-ref.module';
import { ImageSearchModule } from './module/image-search/image-search.module';
import { PrismaModule } from './lib/prisma/prisma.module';

@Module({
  imports: [
    FoodRefModule,
    PrismaModule,
    ChatbotModule,
    ScanFoodModule,
    ImageSearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
