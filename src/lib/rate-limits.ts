import { NextRequest } from 'next/server';

// Whitelisted IPs that bypass rate limiting
export const IP_WHITELIST = new Set(
  (process.env.WHITELISTED_IPS || '').split(',').filter(Boolean)
);

// Dynamic rate limits based on route patterns
export const ROUTE_RATE_LIMITS: { [key: string]: { requests: number; window: number } } = {
  // Authentication routes - stricter limits
  '/api/login': { requests: 5, window: 300 }, // 5 requests per 5 minutes
  '/api/signup': { requests: 3, window: 300 }, // 3 requests per 5 minutes
  
  // Payment routes - moderate limits
  '/api/payments/initiate': { requests: 10, window: 300 }, // 10 requests per 5 minutes
  
  // General API routes - more lenient
  '/api/': { requests: 100, window: 60 }, // 100 requests per minute default
  
  // Admin routes - very lenient
  '/api/admin/': { requests: 300, window: 60 }, // 300 requests per minute
};

// Cool-down period for blocked IPs (in seconds)
export const IP_BLOCK_COOLDOWN = 3600; // 1 hour

export function getRouteRateLimit(req: NextRequest) {
  const path = new URL(req.url).pathname;
  
  // Find the most specific matching route pattern
  const matchingPattern = Object.keys(ROUTE_RATE_LIMITS)
    .filter(pattern => path.startsWith(pattern))
    .sort((a, b) => b.length - a.length)[0];

  return matchingPattern 
    ? ROUTE_RATE_LIMITS[matchingPattern]
    : ROUTE_RATE_LIMITS['/api/']; // Default rate limit
}
