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

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: any = {};
  for (const [key, value] of formData.entries()) {
    params[key] = value;
  }

  const responseHash = calculateResponseHash(params);
  if (responseHash !== params.hash) {
    return new Response('<h2>Payment verification failed. Please contact support.</h2>', {
      headers: { 'Content-Type': 'text/html' },
      status: 400,
    });
  }

  // Find order and verify amount
  const { data: order } = await supabase.from('orders').select('*').eq('txnid', params.txnid).single();
  if (!order || order.amount != params.amount) {
    return new Response('<h2>Order mismatch. Please contact support.</h2>', {
      headers: { 'Content-Type': 'text/html' },
      status: 400,
    });
  }

  // Update order status
  await supabase.from('orders').update({ status: 'COMPLETED' }).eq('txnid', params.txnid);

  return new Response('<h2>Thank you! Your payment was successful.</h2>', {
    headers: { 'Content-Type': 'text/html' },
    status: 200,
  });
}
