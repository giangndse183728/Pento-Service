import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { KeycloakAuthGuard } from './guards/keycloak-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, KeycloakAuthGuard],
  exports: [AuthService, KeycloakAuthGuard],
})
export class AuthModule {}

