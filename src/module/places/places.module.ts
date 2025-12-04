import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from '../../lib/places/places.service';

@Module({
  controllers: [PlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}


