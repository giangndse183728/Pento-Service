import { Module } from '@nestjs/common';
import { FoodRefController } from './food-ref.controller';
import { FoodRefService } from './food-ref.service';

@Module({
  controllers: [FoodRefController],
  providers: [FoodRefService],
})
export class FoodRefModule {}

