import { createClient } from '@supabase/supabase-js';
import { pgDb, isVpsTarget } from './pg-shim';

/**
 * Admin data-layer switch (see lib/supabase.ts). On the VPS target there is
 * no RLS to bypass — the dedicated flocci_official role owns the whole
 * flocci_app_official database — so admin and anon paths share the shim.
 */
function makeAdminClient(): unknown {
  if (isVpsTarget()) return pgDb;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin: any = makeAdminClient();
