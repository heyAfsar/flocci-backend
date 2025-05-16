import { transporter, mailOptions } from '@/lib/nodemailer';
import { resolveCompanyEmail } from '@/ai/flows/resolve-company-email';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const companyContactSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  senderName: z.string().min(1, "Your name is required"),
  senderEmail: z.string().email("Invalid email address for sender"),
  message: z.string().min(1, "Message is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = companyContactSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid input", details: parseResult.error.flatten() }, { status: 400 });
    }

    const { companyName, senderName, senderEmail, message } = parseResult.data;

    // Step 1: Resolve company email using GenAI
    let companyEmailData;
    try {
        companyEmailData = await resolveCompanyEmail({ companyName });
    } catch (aiError) {
        console.error("AI email resolution error:", aiError);
        const aiErrorMessage = aiError instanceof Error ? aiError.message : "Failed to resolve company email using AI";
        return NextResponse.json({ error: "Could not resolve company email", details: aiErrorMessage }, { status: 500 });
    }
    
    if (!companyEmailData || !companyEmailData.emailAddress) {
      return NextResponse.json({ error: "Could not resolve company email address." }, { status: 404 });
    }
    const targetCompanyEmail = companyEmailData.emailAddress;

    // Step 2: Send email
    const emailHtml = `
      <h1>Inquiry for ${companyName}</h1>
      <p><strong>From:</strong> ${senderName} (${senderEmail})</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
      <hr>
      <p><small>This email was sent via NexusConnect's company contact feature.</small></p>
    `;

    await transporter.sendMail(mailOptions(targetCompanyEmail, `Inquiry from ${senderName} via NexusConnect`, emailHtml));
    
    return NextResponse.json({ message: `Email successfully sent to ${companyName} (at ${targetCompanyEmail})!` }, { status: 200 });

  } catch (e) {
    console.error("Company contact form error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    if (e && typeof e === 'object' && 'code' in e) {
      if (e.code === 'ECONNECTION' || e.code === 'ETIMEDOUT') {
        return NextResponse.json({ error: "Failed to connect to SMTP server. Please try again later or check server configuration.", details: errorMessage }, { status: 503 });
      }
    }
    return NextResponse.json({ error: "Failed to send email", details: errorMessage }, { status: 500 });
  }
}
