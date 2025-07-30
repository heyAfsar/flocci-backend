import { createHash, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Use admin client for session management
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// For password hashing
const SALT_ROUNDS = 10;
const PEPPER = process.env.PASSWORD_PEPPER || randomBytes(32).toString('hex');

export async function hashPassword(password: string): Promise<string> {
  // Create a unique salt for this user
  const salt = randomBytes(16).toString('hex');
  
  // Hash password with salt and pepper
  const hash = createHash('sha512')
    .update(password + salt + PEPPER)
    .digest('hex');
    
  // Return salt:hash format
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  const newHash = createHash('sha512')
    .update(password + salt + PEPPER)
    .digest('hex');
  return newHash === hash;
}

// Generate secure session token
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// Create secure session
export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  const { error } = await supabaseAdmin.from('sessions').insert({
    user_id: userId,
    token: await hashToken(token),
    expires_at: expiresAt.toISOString()
  });

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return token;
}

// Hash session token before storing
export async function hashToken(token: string): Promise<string> {
  return createHash('sha256').update(token).digest('hex');
}

// Verify session token
export async function verifySession(token: string): Promise<boolean> {
  const hashedToken = await hashToken(token);
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('token', hashedToken)
    .gt('expires_at', new Date().toISOString())
    .single();

  return !!session;
}
