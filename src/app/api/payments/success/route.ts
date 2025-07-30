import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

const PAYU_SALT = process.env.PAYU_SALT!;

function calculateResponseHash(params: any) {
  const {
    key, txnid, amount, productinfo, firstname, email,
    udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '', status
  } = params;
  const hashString = `${PAYU_SALT}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

// Handle GET requests (redirected from frontend)
export async function GET(req: NextRequest) {
  return new Response('<h2>Payment processing completed. Please check your email for confirmation.</h2>', {
    headers: { 'Content-Type': 'text/html' },
    status: 200,
  });
}

// Handle POST requests (PayU callbacks for server-side verification)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const params: any = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value;
    }

    // Check if this is a valid PayU callback with required fields
    if (!params.txnid || !params.hash || !params.status) {
      console.log('Invalid PayU callback - missing required fields');
      return new Response('OK', { status: 200 }); // Return OK to prevent retries
    }

    const responseHash = calculateResponseHash(params);
    if (responseHash !== params.hash) {
      console.log('PayU hash verification failed');
      return new Response('Invalid hash', { status: 400 });
    }

    // Find order and verify amount
    const { data: order } = await supabase.from('orders').select('*').eq('txnid', params.txnid).single();
    if (!order || order.amount != params.amount) {
      console.log('Order mismatch for txnid:', params.txnid);
      return new Response('Order mismatch', { status: 400 });
    }

    // Update order status only if it's not already completed
    if (order.status !== 'COMPLETED') {
      await supabase.from('orders').update({ 
        status: 'COMPLETED',
        updated_at: new Date().toISOString()
      }).eq('txnid', params.txnid);
      console.log('Order marked as COMPLETED:', params.txnid);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Payment success callback error:', error);
    return new Response('Internal error', { status: 500 });
  }
}
