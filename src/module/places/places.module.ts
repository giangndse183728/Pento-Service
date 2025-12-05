import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { GooglePlacesService } from '../../lib/places/places.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [PlacesController],
  providers: [PlacesService, GooglePlacesService],
  exports: [PlacesService],
  imports: [AuthModule],
})
export class PlacesModule {}


