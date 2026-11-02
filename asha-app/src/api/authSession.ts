/**
 * Holds the OTP-issued worker JWT for API calls (set by AuthContext on login / restore / logout).
 * The server identifies ASHA / ANM / CHO callers only from this token; X-ASHA-Phone is sent
 * alongside for local-dev header mode and admin tooling, and is ignored when a token is present.
 */
let authToken: string | null = null;

/** Locally minted placeholders (offline / pre-v2 builds) are not server credentials. */
const LOCAL_PLACEHOLDER_PREFIXES = ['offline-jwt-', 'jwt-worker-', 'jwt-session-token-'];

export function setAuthToken(token: string | null): void {
  authToken = token && !LOCAL_PLACEHOLDER_PREFIXES.some((p) => token.startsWith(p)) ? token : null;
}

export function getAuthToken(): string | null {
  return authToken;
}

/** Authorization header for the current worker session (empty when not logged in online). */
export function authHeader(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}
