import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';
import { Redis } from '@upstash/redis';
import { IP_WHITELIST, getRouteRateLimit, IP_BLOCK_COOLDOWN } from '@/lib/rate-limits';

export const config = {
  matcher: '/api/:path*',
};

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'anonymous'
  );
}

async function isIpBlocked(ip: string): Promise<boolean> {
  const blockedAt = await redis.get(`blocked:${ip}`);
  if (!blockedAt) return false;

  const blockTime = parseInt(blockedAt as string);
  const cooldownEnds = blockTime + (IP_BLOCK_COOLDOWN * 1000);
  
  if (Date.now() >= cooldownEnds) {
    // Auto-unblock after cooldown
    await redis.del(`blocked:${ip}`);
    await redis.srem('rate-limit:blocked', ip);
    return false;
  }
  
  return true;
}

export async function rateLimit(req: NextRequest) {
  const ip = getClientIp(req);

  // Check IP whitelist
  if (IP_WHITELIST.has(ip)) {
    return null;
  }

  // Check if IP is blocked
  if (await isIpBlocked(ip)) {
    const blockedAt = await redis.get(`blocked:${ip}`);
    const cooldownEnds = parseInt(blockedAt as string) + (IP_BLOCK_COOLDOWN * 1000);
    const remainingTime = Math.ceil((cooldownEnds - Date.now()) / 1000);

    return new NextResponse(
      JSON.stringify({
        error: 'IP is blocked',
        retryAfter: remainingTime
      }),
      {
        status: 429,
        headers: {
          'Retry-After': remainingTime.toString(),
          'Content-Type': 'application/json'
        }
      }
    );
  }

  // Get dynamic rate limit for the route
  const { requests: maxRequests, window: windowSize } = getRouteRateLimit(req);
  const key = `rate-limit:${ip}:${new URL(req.url).pathname}`;

  try {
    const requests = await redis.incr(key);
    if (requests === 1) {
      await redis.expire(key, windowSize);
    }

    if (requests > maxRequests) {
      // Block IP and record timestamp
      await redis.set(`blocked:${ip}`, Date.now().toString());
      await redis.sadd('rate-limit:blocked', ip);

      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          retryAfter: IP_BLOCK_COOLDOWN
        }),
        {
          status: 429,
          headers: {
            'Retry-After': IP_BLOCK_COOLDOWN.toString(),
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    return null;
  } catch (error) {
    console.error('Rate limiting error:', error);
    // On Redis error, allow the request to proceed
    return null;
  }
}

export async function withAuth(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value;
  
  if (!token || !(await verifySession(token))) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401 }
    );
  }
  
  return null;
}

export default async function middleware(req: NextRequest) {
  // Only apply middleware to API routes
  if (!req.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Check rate limits first
  const rateLimitResponse = await rateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Then check auth for protected routes
  if (req.nextUrl.pathname.startsWith('/api/admin')) {
    const authResponse = await withAuth(req);
    if (authResponse) {
      return authResponse;
    }
  }

  return NextResponse.next();
}
