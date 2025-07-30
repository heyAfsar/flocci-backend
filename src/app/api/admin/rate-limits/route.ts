import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { withAuth } from '@/middleware';
import { IP_WHITELIST } from '@/lib/rate-limits';
import { supabase } from '@/lib/supabase';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',');

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('session_token')?.value;
  if (!token) return false;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;

  return ADMIN_EMAILS.includes(user.email || '');
}

export async function GET(req: NextRequest) {
  const authRes = await withAuth(req);
  if (authRes) return authRes;

  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // Get all blocked IPs with their block timestamps
    const blockedIPs = await redis.smembers('rate-limit:blocked');
    const blockedDetails = await Promise.all(
      blockedIPs.map(async (ip) => {
        const blockedAt = await redis.get(`blocked:${ip}`);
        return {
          ip,
          blockedAt: blockedAt ? new Date(parseInt(blockedAt as string)).toISOString() : null
        };
      })
    );

    return NextResponse.json({
      whitelisted_ips: Array.from(IP_WHITELIST),
      blocked_ips: blockedDetails
    });
  } catch (e) {
    console.error('Rate limit status error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch rate limit status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authRes = await withAuth(req);
  if (authRes) return authRes;

  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { action, ip } = await req.json();

    switch (action) {
      case 'whitelist':
        // Update environment variable (you'll need to implement this based on your deployment)
        // For now, we'll just update the in-memory set
        IP_WHITELIST.add(ip);
        break;

      case 'unblock':
        await redis.del(`blocked:${ip}`);
        await redis.srem('rate-limit:blocked', ip);
        break;

      case 'remove-whitelist':
        IP_WHITELIST.delete(ip);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Rate limit management error:', e);
    return NextResponse.json(
      { error: 'Failed to manage rate limit' },
      { status: 500 }
    );
  }
}
