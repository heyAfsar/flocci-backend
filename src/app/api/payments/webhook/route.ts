import { NextRequest, NextResponse } from "next/server";
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
  try {
    console.log('Payment webhook received');
    
    const formData = await req.formData();
    const params: any = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value;
    }

    console.log('Webhook payload:', { 
      txnid: params.txnid, 
      status: params.status, 
      amount: params.amount 
    });

    // Validate required fields
    if (!params.txnid || !params.hash || !params.status) {
      console.log('Webhook: Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify PayU hash
    const expectedHash = calculateResponseHash(params);
    if (expectedHash !== params.hash) {
      console.log('Webhook: Hash verification failed');
      return NextResponse.json({ error: 'Invalid hash' }, { status: 400 });
    }

    // Find and verify order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('txnid', params.txnid)
      .single();

    if (orderError || !order) {
      console.log('Webhook: Order not found:', params.txnid);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.amount != params.amount) {
      console.log('Webhook: Amount mismatch');
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    // Update order status based on PayU response
    let newStatus = 'PENDING';
    if (params.status === 'success') {
      newStatus = 'COMPLETED';
    } else if (params.status === 'failure') {
      newStatus = 'FAILED';
    } else if (params.status === 'cancel') {
      newStatus = 'CANCELLED';
    }

    // Only update if status has changed
    if (order.status !== newStatus) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
          payu_response: JSON.stringify(params)
        })
        .eq('txnid', params.txnid);

      if (updateError) {
        console.error('Webhook: Failed to update order:', updateError);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
      }

      console.log(`Webhook: Order ${params.txnid} updated to ${newStatus}`);
    }

    // Log to payment_logs table for audit trail
    await supabase.from('payment_logs').insert([{
      order_id: order.id,
      event_type: 'WEBHOOK',
      status: newStatus,
      details: JSON.stringify(params),
      created_at: new Date().toISOString()
    }]);

    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });

  } catch (error) {
    console.error('Payment webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
