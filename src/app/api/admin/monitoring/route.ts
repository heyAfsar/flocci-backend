import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth } from '@/middleware';
import { isAdmin } from '@/lib/admin';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

interface ErrorLog {
  status: string;
  created_at: string;
  details?: string;
}

interface SystemMetrics {
  errorRate: number;
  rateLimitHits: number;
  topErrorTypes: [string, number][];
  blockedIPs: string[];
  errorTrend: {
    intervals: string[];
    counts: number[];
  };
  systemStatus: {
    healthy: boolean;
    lastError?: string;
    lastErrorTime?: string;
  };
}

export async function GET(req: NextRequest) {
  // Verify admin authentication
  const authRes = await withAuth(req);
  if (authRes) return authRes;

  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const minutesAgo = Math.min(parseInt(searchParams.get('minutes') || '60'), 1440); // Max 24 hours
    const startTime = new Date(Date.now() - minutesAgo * 60 * 1000);

    // Get recent errors with optimized query
    const { data: errors } = await supabase
      .from('payment_logs')
      .select('status, created_at, details')
      .eq('event_type', 'ERROR')
      .gt('created_at', startTime.toISOString())
      .order('created_at', { ascending: false });

    // Get blocked IPs from Redis
    const blockedIPs = await redis.smembers('rate-limit:blocked');
    const blockDetails = await Promise.all(
      blockedIPs.map(async (ip) => {
        const blockedAt = await redis.get(`blocked:${ip}`);
        return {
          ip,
          blockedAt: blockedAt ? new Date(parseInt(blockedAt as string)).toISOString() : null
        };
      })
    );

    // Create 5-minute intervals for error trend
    const intervalSize = 5; // minutes
    const numIntervals = Math.ceil(minutesAgo / intervalSize);
    const timeIntervals = Array.from({ length: numIntervals }, (_, i) => {
      return new Date(Date.now() - (i + 1) * intervalSize * 60 * 1000).toISOString();
    });

    // Efficiently calculate error counts per interval
    const errorsByInterval = new Array(numIntervals).fill(0);
    errors?.forEach((error: ErrorLog) => {
      const errorTime = new Date(error.created_at);
      const intervalIndex = Math.floor(
        (Date.now() - errorTime.getTime()) / (intervalSize * 60 * 1000)
      );
      if (intervalIndex < numIntervals) {
        errorsByInterval[intervalIndex]++;
      }
    });

    // Calculate system metrics
    const metrics: SystemMetrics = {
      errorRate: errors ? (errors.length / minutesAgo) : 0,
      rateLimitHits: blockDetails.length,
      topErrorTypes: errors ? 
        Array.from(
          errors.reduce((acc, curr: ErrorLog) => {
            acc.set(curr.status, (acc.get(curr.status) || 0) + 1);
            return acc;
          }, new Map<string, number>())
        ).sort((a, b) => b[1] - a[1]) : [],
      blockedIPs: blockDetails.map(d => d.ip),
      errorTrend: {
        intervals: timeIntervals,
        counts: errorsByInterval
      },
      systemStatus: {
        healthy: true
      }
    };

    // Determine system health
    if (errors && errors.length > 0) {
      const latestError = errors[0];
      metrics.systemStatus = {
        healthy: errors.length < minutesAgo * 0.1, // Less than 10% error rate
        lastError: latestError.details || latestError.status,
        lastErrorTime: latestError.created_at
      };
    }

    return NextResponse.json({
      metrics,
      recentErrors: errors || [],
      rateLimit: {
        blockedIPs: blockDetails,
        totalBlocked: blockDetails.length
      }
    });

  } catch (e) {
    console.error('System monitoring error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch system metrics' },
      { status: 500 }
    );
  }
}
