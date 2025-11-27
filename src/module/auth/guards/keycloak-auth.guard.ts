import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { KeycloakAuthRequest } from '../interfaces/keycloak-auth-request.interface';

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
  private readonly logger = new Logger(KeycloakAuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<KeycloakAuthRequest>();

    const authorizationHeader =
      request.headers.authorization ?? request.headers.Authorization;

    this.logger.debug(
      `Authorization header received: ${
        typeof authorizationHeader === 'string'
          ? `${authorizationHeader.slice(0, 20)}...`
          : 'undefined'
      }`,
    );

    request.keycloakUser = await this.authService.verifyBearerToken(
      typeof authorizationHeader === 'string'
        ? authorizationHeader
        : undefined,
    );

    return true;
  }
}

