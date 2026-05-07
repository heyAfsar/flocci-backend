import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest, { params }: { params: { txnid: string } }) {
  const internalApiKey = process.env.PAYMENT_STATUS_API_KEY?.trim();

  if (internalApiKey) {
    const provided = req.headers.get("x-payment-status-key")?.trim();
    if (!provided || provided !== internalApiKey) {
      return unauthorized();
    }
  }

  const txnid = params.txnid?.trim();
  if (!txnid) {
    return NextResponse.json({ error: "txnid is required" }, { status: 400 });
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id,txnid,amount,currency,status,productinfo,firstname,email,phone,payu_response,created_at,updated_at")
    .eq("txnid", txnid)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      txnid: order.txnid,
      status: order.status,
      amount: Number(order.amount),
      currency: order.currency,
      productinfo: order.productinfo,
      firstname: order.firstname,
      email: order.email,
      phone: order.phone,
      providerResponse: order.payu_response ?? null,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    },
    { status: 200 },
  );
}
