import { NextRequest } from "next/server";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { amount, productinfo, firstname, email, phone } = body;

  // Generate txnid
  const txnid = uuidv4();

  // Save order to Supabase
  await supabase.from("orders").insert([
    {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      status: "PENDING",
    },
  ]);

  // PayU credentials from env
  const key = process.env.PAYU_KEY!;
  const salt = process.env.PAYU_SALT!;
  // Use frontend URLs for PayU callbacks
  const surl = 'https://www.flocci.in/api/payments/success';
  const furl = 'https://www.flocci.in/api/payments/failure';
  const curl = 'https://www.flocci.in/api/payments/cancel';
  const env = process.env.PAYU_ENV || 'test';
  
  // Determine PayU URL based on environment
  const payuUrl = env === 'production' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
  console.log('DEBUG PAYU_ENV:', env, 'PayU URL:', payuUrl);

  // Hash string
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
  const hash = crypto.createHash("sha512").update(hashString).digest("hex");

  // HTML form
  const html = `
    <html>
      <head><title>Redirecting to PayU...</title></head>
      <body onload="document.forms[0].submit()">
        <p>Please wait, you are being redirected to the payment gateway.</p>
        <form action="${payuUrl}" method="post">
          <input type="hidden" name="key" value="${key}" />
          <input type="hidden" name="txnid" value="${txnid}" />
          <input type="hidden" name="productinfo" value="${productinfo}" />
          <input type="hidden" name="amount" value="${amount}" />
          <input type="hidden" name="email" value="${email}" />
          <input type="hidden" name="firstname" value="${firstname}" />
          <input type="hidden" name="surl" value="${surl}" />
          <input type="hidden" name="furl" value="${furl}" />
          <input type="hidden" name="curl" value="${curl}" />
          <input type="hidden" name="phone" value="${phone}" />
          <input type="hidden" name="hash" value="${hash}" />
        </form>
      </body>
    </html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
    status: 200,
  });
}
