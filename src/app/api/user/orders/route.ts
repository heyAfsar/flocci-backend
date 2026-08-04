import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, applySetCookies } from '@/lib/identity';
import { isVpsTarget, pgQuery } from '@/lib/pg-shim';

/**
 * A candidate's payment history — matched on their profile email
 * (case-insensitive), newest first. `orders` predates the identity system
 * and has no profile_id column, so email is the only link available.
 */

interface OrderRow {
  id: string;
  txnid: string;
  amount: string;
  currency: string;
  status: string;
  productinfo: string;
  payment_method: string | null;
  created_at: string | Date;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  if (!isVpsTarget()) {
    return NextResponse.json(
      { error: 'Order history is temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    );
  }

  try {
    const session = await resolveSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Please sign in to continue' }, { status: 401 });
    }

    const rows = await pgQuery<OrderRow>(
      `SELECT id, txnid, amount, currency, status, productinfo, payment_method, created_at
       FROM orders
       WHERE lower(email) = lower($1)
       ORDER BY created_at DESC`,
      [session.user.email]
    );

    const orders = rows.map((row) => ({
      orderId: row.id,
      txnid: row.txnid,
      amount: String(row.amount),
      currency: row.currency,
      status: row.status,
      productinfo: row.productinfo,
      paymentMethod: row.payment_method,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    }));

    const response = NextResponse.json({ orders }, { status: 200 });
    applySetCookies(response, session.setCookies);
    return response;
  } catch (e) {
    console.error('List orders error:', e);
    return NextResponse.json({ error: 'Failed to load order history' }, { status: 500 });
  }
}
