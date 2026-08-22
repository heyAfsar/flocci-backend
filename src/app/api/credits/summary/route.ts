import { NextRequest, NextResponse } from 'next/server';
import {
  APP_ID,
  applySetCookies,
  identityEnabled,
  resolveSession,
} from '@/lib/identity';

export const dynamic = 'force-dynamic';

const GATEWAY = (process.env.FLOCCI_GATEWAY_URL || 'https://gateway.flocci.in').replace(/\/$/, '');
const BUY_PATH = `https://account.flocci.in/billing?app_id=${APP_ID}`;
const MANAGE_PATH = 'https://account.flocci.in/billing';

type WalletResponse = {
  billing_status?: string;
  platform_remaining?: unknown;
  app_lot_remaining?: unknown;
  allowance?: {
    remaining?: unknown;
    gift_remaining?: unknown;
    debt?: unknown;
    resets_at?: string | null;
  } | null;
};

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function privateResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, Authorization');
  return response;
}

function unavailable(setCookies: string[] = []) {
  const response = NextResponse.json({ unavailable: true }, { status: 200 });
  applySetCookies(response, setCookies);
  return privateResponse(response);
}

/**
 * Self-only in-app wallet summary (KB roadmaps/79).
 *
 * The browser never receives either service credential. This BFF resolves the
 * signed-in person's central identity id, reads the shared payment wallet
 * through the public gateway's dual-key contract, and projects only the four
 * display buckets used across Flocci apps. Missing configuration or payment
 * downtime fails soft so account navigation remains usable without guessing a
 * balance.
 */
export async function GET(req: NextRequest) {
  if (!identityEnabled()) return unavailable();

  const session = await resolveSession(req);
  if (!session) {
    return privateResponse(NextResponse.json({ error: 'Not authenticated' }, { status: 401 }));
  }

  const paymentServiceKey = process.env.PAYMENT_SERVICE_KEY;
  if (!paymentServiceKey) return unavailable(session.setCookies);

  const headers: Record<string, string> = {
    'X-Flocci-Service-Key': paymentServiceKey,
  };
  if (process.env.FLOCCI_SERVICE_KEY) {
    headers['X-Flocci-Gateway-Key'] = process.env.FLOCCI_SERVICE_KEY;
  }

  try {
    const url = new URL(`${GATEWAY}/api/payments/v1/credits/wallet`);
    url.searchParams.set('user_id', session.claims.sub);
    url.searchParams.set('app_id', APP_ID);

    const walletResponse = await fetch(url, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
    });
    if (!walletResponse.ok) return unavailable(session.setCookies);

    const wallet = (await walletResponse.json()) as WalletResponse;
    const monthlySigned = numberOrZero(wallet.allowance?.remaining);
    const gift = numberOrZero(wallet.allowance?.gift_remaining);
    const inApp = numberOrZero(wallet.app_lot_remaining);
    const platform = numberOrZero(wallet.platform_remaining);
    const spendable = monthlySigned + gift + inApp + platform;
    const debt = numberOrZero(wallet.allowance?.debt) || Math.max(0, -monthlySigned);
    const billingStatus =
      wallet.billing_status === 'halted' || wallet.billing_status === 'flagged'
        ? wallet.billing_status
        : 'ok';

    // Halted/debt already render as dedicated banners in the client. Keep the
    // optional hint line for a distinct, useful next action.
    const hint = billingStatus === 'halted' || debt > 0
      ? undefined
      : spendable < 100
        ? { tone: 'warn', text: 'Credits are running low — top up so nothing stops mid-save.' }
        : inApp > 0
          ? { tone: 'info', text: 'Free monthly credits are paused while your in-app pack is active — they resume when it runs out.' }
          : undefined;

    const response = NextResponse.json({
      app_id: APP_ID,
      spendable,
      buckets: {
        monthly: {
          remaining: Math.max(0, monthlySigned),
          resets_at: wallet.allowance?.resets_at ?? null,
        },
        gift: { remaining: gift },
        in_app: { remaining: inApp },
        platform: { remaining: platform },
      },
      debt,
      billing_status: billingStatus,
      buy_path: BUY_PATH,
      manage_path: MANAGE_PATH,
      ...(hint ? { hint } : {}),
    });
    applySetCookies(response, session.setCookies);
    return privateResponse(response);
  } catch {
    return unavailable(session.setCookies);
  }
}
