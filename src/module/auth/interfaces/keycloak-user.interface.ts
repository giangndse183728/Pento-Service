export interface KeycloakUser {
  exp?: number;
  iat?: number;
  auth_time?: number;
  jti?: string;
  iss?: string;
  aud?: string | string[];
  sub?: string;
  typ?: string;
  azp?: string;
  session_state?: string;
  acr?: string;
  'allowed-origins'?: string[];
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<
    string,
    {
      roles?: string[];
    }
  >;
  scope?: string;
  sid?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  [claim: string]: unknown;
}


