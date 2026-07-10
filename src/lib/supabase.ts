import { createClient } from '@supabase/supabase-js';
import { pgDb, isVpsTarget } from './pg-shim';

/**
 * Data-layer switch (remote adoption pattern — flag + fallback):
 *   DB_TARGET=vps      → VPS Postgres via the pgbouncer TLS door (pg shim)
 *   DB_TARGET unset/…  → legacy Supabase client (requires SUPABASE_* envs)
 * The shim implements exactly the query-builder subset this codebase uses,
 * so route code is identical on both targets.
 */
function makeClient(): unknown {
  if (isVpsTarget()) return pgDb;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(supabaseUrl, supabaseAnonKey);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = makeClient();
