import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { importSPKI, jwtVerify } from 'jose';
import { KeycloakUser } from './interfaces/keycloak-user.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private publicKeyPromise?: ReturnType<typeof importSPKI>;

  private get issuer(): string | undefined {
    return process.env.KEYCLOAK_ISSUER?.trim();
  }

  private get audience(): string | undefined {
    return process.env.KEYCLOAK_AUDIENCE?.trim();
  }

  private get rawPublicKey(): string {
    const key = process.env.KEYCLOAK_PUBLIC_KEY?.trim();
    if (!key) {
      throw new InternalServerErrorException(
        'KEYCLOAK_PUBLIC_KEY is missing from environment configuration.',
      );
    }

    return key;
  }

  private formatPublicKey(key: string): string {
    if (key.includes('BEGIN PUBLIC KEY')) {
      return key;
    }

    const chunked = key.match(/.{1,64}/g)?.join('\n') ?? key;
    return `-----BEGIN PUBLIC KEY-----\n${chunked}\n-----END PUBLIC KEY-----`;
  }

  private async getPublicKey() {
    if (!this.publicKeyPromise) {
      const pem = this.formatPublicKey(this.rawPublicKey);
      this.publicKeyPromise = importSPKI(pem, 'RS256');
    }

    return this.publicKeyPromise;
  }

  async verifyBearerToken(
    authorizationHeader?: string,
  ): Promise<KeycloakUser> {
    if (!authorizationHeader) {
      throw new UnauthorizedException('Authorization header is missing.');
    }

    const [scheme, token] = authorizationHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException(
        'Authorization header must be a Bearer token.',
      );
    }

    try {
      const publicKey = await this.getPublicKey();
      const { payload } = await jwtVerify(token, publicKey, {
        issuer: this.issuer,
        audience: this.audience,
      });

      return payload as KeycloakUser;
    } catch (error) {
      this.logger.warn('Failed to verify Keycloak JWT', error as Error);
      throw new UnauthorizedException('Invalid Keycloak token.');
    }
  }
}

