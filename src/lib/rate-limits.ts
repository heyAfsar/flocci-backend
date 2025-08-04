import { NextRequest } from 'next/server';

// Whitelisted IPs that bypass rate limiting
export const IP_WHITELIST = new Set(
  (process.env.WHITELISTED_IPS || '').split(',').filter(Boolean)
);

// Whitelisted domains that bypass rate limiting
export const DOMAIN_WHITELIST = new Set(
  (process.env.WHITELISTED_DOMAINS || '').split(',').filter(Boolean)
);

// Function to check if a request should be whitelisted
export function isWhitelisted(req: NextRequest): boolean {
  // Get client IP
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
             req.headers.get('x-real-ip') || 
             req.ip || 
             'unknown';
  
  // Check IP whitelist
  if (IP_WHITELIST.has(ip)) {
    return true;
  }
  
  // Get origin/referer for domain checking
  const origin = req.headers.get('origin') || req.headers.get('referer');
  
  if (origin) {
    try {
      const url = new URL(origin);
      const domain = url.hostname;
      
      // Check exact domain match
      if (DOMAIN_WHITELIST.has(domain)) {
        return true;
      }
      
      // Check wildcard domain match (*.lovable.app)
      for (const whitelistedDomain of DOMAIN_WHITELIST) {
        if (whitelistedDomain.startsWith('*.')) {
          const baseDomain = whitelistedDomain.slice(2);
          if (domain.endsWith('.' + baseDomain) || domain === baseDomain) {
            return true;
          }
        }
      }
    } catch (error) {
      // Invalid URL, continue with other checks
    }
  }
  
  return false;
}

// Dynamic rate limits based on route patterns
export const ROUTE_RATE_LIMITS: { [key: string]: { requests: number; window: number } } = {
  // Authentication routes - more lenient for multiple devices
  '/api/login': { requests: 15, window: 300 }, // 15 requests per 5 minutes (allowing for multiple devices)
  '/api/signup': { requests: 5, window: 300 }, // 5 requests per 5 minutes
  
  // Payment routes - moderate limits
  '/api/payments/initiate': { requests: 10, window: 300 }, // 10 requests per 5 minutes
  
  // General API routes - more lenient
  '/api/': { requests: 100, window: 60 }, // 100 requests per minute default
  
  // Admin routes - very lenient
  '/api/admin/': { requests: 300, window: 60 }, // 300 requests per minute
};

// Cool-down period for blocked IPs (in seconds)
export const IP_BLOCK_COOLDOWN = 900; // 15 minutes instead of 1 hour
export const AUTH_BLOCK_COOLDOWN = 300; // 5 minutes for auth-related blocks

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
