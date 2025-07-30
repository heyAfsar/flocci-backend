import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth } from '@/middleware';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',');

function isValidISODate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime()) && dateStr === date.toISOString();
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('session_token')?.value;
  if (!token) return false;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;

  return ADMIN_EMAILS.includes(user.email || '');
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
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate date parameters
    if (startDate && !isValidISODate(startDate)) {
      return NextResponse.json(
        { error: 'Invalid start date format. Use ISO format.' },
        { status: 400 }
      );
    }
    if (endDate && !isValidISODate(endDate)) {
      return NextResponse.json(
        { error: 'Invalid end date format. Use ISO format.' },
        { status: 400 }
      );
    }

    // Base query for counts
    const countQuery = supabase.from('orders').select('*', { count: 'exact' });

    // Apply filters to count query
    const filters: Record<string, any> = {};
    if (status) filters.status = status;
    if (startDate) filters.created_at = { gte: startDate };
    if (endDate) filters.created_at = { ...filters.created_at, lte: endDate };

    // Get total count first
    const { count, error: countError } = await countQuery
      .match(filters);
    if (countError) {
      console.error('Count error:', countError);
      return NextResponse.json(
        { error: 'Failed to get total count' },
        { status: 500 }
      );
    }

    // Build data query with efficient joins
    const dataQuery = supabase.from('orders')
      .select(`
        id,
        txnid,
        amount,
        status,
        created_at,
        payment_logs!inner (
          event_type,
          status,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    // Apply same filters to data query
    if (status) {
      dataQuery.eq('status', status);
    }
    if (startDate) {
      dataQuery.gte('created_at', startDate);
    }
    if (endDate) {
      dataQuery.lte('created_at', endDate);
    }

    // Get paginated results
    const { data: orders, error: ordersError } = await dataQuery
      .range(offset, offset + limit - 1);

    if (ordersError) {
      console.error('Orders fetch error:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // Get summary statistics
    const { data: stats } = await supabase.rpc('get_payment_stats', {
      start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: endDate || new Date().toISOString()
    });

    return NextResponse.json({
      orders,
      total: count || 0,
      stats,
      pagination: {
        offset,
        limit,
        hasMore: (count || 0) > offset + limit
      }
    });

  } catch (e) {
    console.error('Admin dashboard error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
