'use server';
/**
 * Resolve a company name to a likely contact email address.
 *
 * Adopted onto the shared Flocci intelligence service (DeepSeek via the
 * public gateway) — the previous Gemini path shipped an invalid model id
 * ('gemini-1-pro') so it ALWAYS fell through to the contact@ fallback in
 * production; the service call is a strict upgrade. The exported signature
 * and the fallback behavior are unchanged.
 */

import { z } from 'zod';

const ResolveCompanyEmailInputSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
});
export type ResolveCompanyEmailInput = z.infer<typeof ResolveCompanyEmailInputSchema>;

const ResolveCompanyEmailOutputSchema = z.object({
  emailAddress: z.string().email('Must be a valid email address'),
});
export type ResolveCompanyEmailOutput = z.infer<typeof ResolveCompanyEmailOutputSchema>;

export async function resolveCompanyEmail(input: ResolveCompanyEmailInput): Promise<ResolveCompanyEmailOutput> {
  try {
    const validatedInput = ResolveCompanyEmailInputSchema.parse(input);

    const gateway = (process.env.FLOCCI_GATEWAY_URL || 'https://gateway.flocci.in').replace(/\/$/, '');
    const serviceKey = process.env.FLOCCI_SERVICE_KEY;
    if (!serviceKey) throw new Error('FLOCCI_SERVICE_KEY not configured');

    const prompt = `You are an expert at finding company email addresses.
For the company "${validatedInput.companyName}", provide their most likely general contact email address.
Only return the email address, nothing else. If you can't determine it with high confidence, return support@${validatedInput.companyName.toLowerCase().replace(/\s+/g, '')}.com`;

    const res = await fetch(`${gateway}/api/intelligence/v1/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Flocci-Service-Key': serviceKey,
      },
      body: JSON.stringify({
        app_id: 'official-website',
        feature_key: 'company-email-resolve',
        prompt,
        max_tokens: 60,
        temperature: 0.2,
        charge: false,
      }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`intelligence-service ${res.status}`);
    const body = (await res.json()) as { text?: string; output?: string; content?: string };
    const raw = (body.text || body.output || body.content || '').trim();
    const email = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || raw;

    return ResolveCompanyEmailOutputSchema.parse({ emailAddress: email });
  } catch (error) {
    console.error('Company email resolution error:', error);
    // Fallback to a default format if AI generation fails
    const sanitizedCompanyName = input.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return {
      emailAddress: `contact@${sanitizedCompanyName}.com`,
    };
  }
}
