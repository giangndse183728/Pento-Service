import {
  UnauthorizedException,
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  UseGuards,
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../guards/keycloak-auth.guard';
import { KeycloakAuthRequest } from '../interfaces/keycloak-auth-request.interface';
import { KeycloakUser } from '../interfaces/keycloak-user.interface';

export function WithKeycloakAuth() {
  return applyDecorators(UseGuards(KeycloakAuthGuard));
}

export const InjectKeycloakUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): KeycloakUser => {
    const request = ctx.switchToHttp().getRequest<KeycloakAuthRequest>();
    if (!request.keycloakUser) {
      throw new UnauthorizedException(
        'Keycloak user context is missing on the request.',
      );
    }

    return request.keycloakUser;
  },
);

