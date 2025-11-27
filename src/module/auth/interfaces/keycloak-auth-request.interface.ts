import { Request } from 'express';
import { KeycloakUser } from './keycloak-user.interface';

export interface KeycloakAuthRequest extends Request {
  keycloakUser?: KeycloakUser;
}


