import { NextRequest } from 'next/server';
import { supabase } from './supabase';
import { identityEnabled, resolveSession } from './identity';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',');

export async function isAdmin(req: NextRequest): Promise<boolean> {
  if (identityEnabled()) {
    // Admin = a valid Flocci identity session whose email is allowlisted
    // (or whose local profile role is admin — product-owned role).
    const session = await resolveSession(req);
    if (!session) return false;
    return ADMIN_EMAILS.includes(session.user.email || '') || session.user.role === 'admin';
  }

  const token = req.cookies.get('session_token')?.value;
  if (!token) return false;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return false;
  return ADMIN_EMAILS.includes(user.email || '');
}
