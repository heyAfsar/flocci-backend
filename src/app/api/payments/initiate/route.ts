import { NextRequest } from "next/server";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
import { z } from "zod";

const initiateSchema = z.object({
  amount: z.union([z.number(), z.string()]).transform((v) => Number(v)).pipe(z.number().positive()),
  productinfo: z.string().trim().min(1).max(255),
  firstname: z.string().trim().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().trim().min(7).max(20),
  surl: z.string().url().optional(),
  furl: z.string().url().optional(),
  curl: z.string().url().optional(),
  udf1: z.string().max(255).optional(),
  udf2: z.string().max(255).optional(),
  udf3: z.string().max(255).optional(),
  udf4: z.string().max(255).optional(),
  udf5: z.string().max(255).optional(),
});

function getAllowedCallbackHosts(): string[] {
  const raw = process.env.PAYMENT_CALLBACK_ALLOWLIST?.trim();
  if (raw) {
    return raw.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  }
  return ["flocci.in", "www.flocci.in", "aikids.flocci.in", "localhost", "127.0.0.1"];
}

function isAllowedHost(hostname: string, allowlist: string[]): boolean {
  const host = hostname.toLowerCase();
  return allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function sanitizeCallbackUrl(urlString: string | undefined, fallback: string, allowlist: string[]): string {
  if (!urlString) return fallback;
  const parsed = new URL(urlString);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https callback URLs are allowed");
  }
  if (!isAllowedHost(parsed.hostname, allowlist)) {
    throw new Error(`Callback host '${parsed.hostname}' is not allowed`);
  }
  return parsed.toString();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = initiateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid payment initiation payload",
        fields: parsed.error.flatten().fieldErrors,
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  const {
    amount,
    productinfo,
    firstname,
    email,
    phone,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
  } = parsed.data;

  const callbackAllowlist = getAllowedCallbackHosts();

  // Generate txnid
  const txnid = uuidv4();

  // PayU credentials from env
  const key = process.env.PAYU_KEY!;
  const salt = process.env.PAYU_SALT!;
  if (!key || !salt) {
    return new Response(JSON.stringify({ error: "PAYU_KEY / PAYU_SALT missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Callback URLs can be overridden by trusted callers (e.g. AI Kids backend)
  // but only to allowlisted hostnames.
  const surlFallback = process.env.PAYU_SURL || "https://www.flocci.in/api/payments/success";
  const furlFallback = process.env.PAYU_FURL || "https://www.flocci.in/api/payments/failure";
  const curlFallback = process.env.PAYU_CURL || "https://www.flocci.in/api/payments/cancel";

  let surl: string;
  let furl: string;
  let curl: string;
  try {
    surl = sanitizeCallbackUrl(parsed.data.surl, surlFallback, callbackAllowlist);
    furl = sanitizeCallbackUrl(parsed.data.furl, furlFallback, callbackAllowlist);
    curl = sanitizeCallbackUrl(parsed.data.curl, curlFallback, callbackAllowlist);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid callback URL";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const env = process.env.PAYU_ENV || 'test';
  
  // Determine PayU URL based on environment
  const payuUrl = env === 'production' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
  console.log('DEBUG PAYU_ENV:', env, 'PayU URL:', payuUrl);

  // Hash string with optional udf1-udf5 passthrough
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1 ?? ""}|${udf2 ?? ""}|${udf3 ?? ""}|${udf4 ?? ""}|${udf5 ?? ""}||||||${salt}`;
  const hash = crypto.createHash("sha512").update(hashString).digest("hex");

  // Save order to Supabase
  const { data: insertedOrder, error: insertError } = await supabase
    .from("orders")
    .insert([
      {
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        phone,
        status: "PENDING",
        payu_response: {
          event: "INITIATED",
          surl,
          furl,
          curl,
          udf1: udf1 ?? null,
          udf2: udf2 ?? null,
          udf3: udf3 ?? null,
          udf4: udf4 ?? null,
          udf5: udf5 ?? null,
        },
      },
    ])
    .select("id")
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: "Failed to create order", details: insertError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  await supabase.from("payment_logs").insert([
    {
      order_id: insertedOrder.id,
      event_type: "INITIATED",
      status: "PENDING",
      details: {
        txnid,
        amount,
        surl,
        furl,
        curl,
      },
      created_at: new Date().toISOString(),
    },
  ]);

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
          <input type="hidden" name="udf1" value="${udf1 ?? ""}" />
          <input type="hidden" name="udf2" value="${udf2 ?? ""}" />
          <input type="hidden" name="udf3" value="${udf3 ?? ""}" />
          <input type="hidden" name="udf4" value="${udf4 ?? ""}" />
          <input type="hidden" name="udf5" value="${udf5 ?? ""}" />
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
