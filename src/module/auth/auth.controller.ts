import { Controller, Get } from '@nestjs/common';
import {
  InjectKeycloakUser,
  WithKeycloakAuth,
} from './decorators/keycloak-auth.decorator';
import { KeycloakUser } from './interfaces/keycloak-user.interface';

@Controller('auth')
export class AuthController {
  @Get('profile')
  @WithKeycloakAuth()
  getAuthenticatedProfile(
    @InjectKeycloakUser() user: KeycloakUser,
  ): KeycloakUser {
    return user;
  }
}

