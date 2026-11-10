/** Returns whether an account ban is currently in effect. */
export function activeBan(
  ban: { revoked_at: string | null; expires_at: string | null } | null | undefined,
  now = Date.now(),
) {
  return Boolean(ban && !ban.revoked_at && (!ban.expires_at || Date.parse(ban.expires_at) > now));
}
