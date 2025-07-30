import { NextRequest } from 'next/server';
import { supabase } from './supabase';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',');

export async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('session_token')?.value;
  if (!token) return false;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;

  return ADMIN_EMAILS.includes(user.email || '');
}
