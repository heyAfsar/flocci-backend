import { NextRequest } from 'next/server';
import { supabase } from './supabase';
import { identityEnabled, resolveSession } from './identity';

/**
 * Allowlist of admin emails. Split-then-filter matters: `''.split(',')` is
 * `['']`, so an UNSET `ADMIN_EMAILS` would otherwise allowlist the empty
 * string and grant admin to any session whose email resolved to ''. Flocci's
 * admin is currently governed purely by `profiles.role`, with this env
 * deliberately unset — exactly the configuration that footgun fires in.
 * Normalised to lowercase/trimmed so a stray space or capital cannot silently
 * drop an intended admin.
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Empty/absent email never matches, regardless of allowlist contents. */
const isAllowlisted = (email: string | null | undefined): boolean => {
  const normalised = (email || '').trim().toLowerCase();
  return normalised.length > 0 && ADMIN_EMAILS.includes(normalised);
};

export async function isAdmin(req: NextRequest): Promise<boolean> {
  if (identityEnabled()) {
    // Admin = a valid Flocci identity session whose email is allowlisted
    // (or whose local profile role is admin — product-owned role).
    const session = await resolveSession(req);
    if (!session) return false;
    return isAllowlisted(session.user.email) || session.user.role === 'admin';
  }

  const token = req.cookies.get('session_token')?.value;
  if (!token) return false;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return false;
  return isAllowlisted(user.email);
}
