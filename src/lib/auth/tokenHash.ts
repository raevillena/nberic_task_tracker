import crypto from 'crypto';

/**
 * Hash a token for storage/lookup (we never store plain tokens).
 * Used consistently for access and refresh token hashes in token_sessions.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
