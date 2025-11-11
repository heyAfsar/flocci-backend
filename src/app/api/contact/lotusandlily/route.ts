import { transporter, mailOptions } from '@/lib/nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().min(1, "Company is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone is required"),
  location: z.string().min(1, "Location is required"),
  message: z.string().min(1, "Message is required"),
});

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*', // Or your specific frontend origin
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = contactSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid input", details: parseResult.error.flatten() }, { status: 400 });
    }

    const { name, company, email, phone, location, message } = parseResult.data;

    const lotusandlilyEmail = process.env.lotusandlilyEmail;
    
    if (!lotusandlilyEmail) {
      console.error("lotusandlilyEmail environment variable is not set");
      return new NextResponse(JSON.stringify({ error: "Email configuration error" }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const emailHtml = `
      <h1>New Contact Form Submission - Lotus and Lily</h1>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Company:</strong> ${company}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Location:</strong> ${location}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `;

    await transporter.sendMail(mailOptions(lotusandlilyEmail, `New Message from ${name} - ${company}`, emailHtml));

    return new NextResponse(JSON.stringify({ message: "Email sent successfully!" }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Or your specific frontend origin
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (e) {
    console.error("Contact form error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    // Check if it's a Nodemailer specific error or timeout
    if (e && typeof e === 'object' && 'code' in e) {
      if (e.code === 'ECONNECTION' || e.code === 'ETIMEDOUT') {
        return new NextResponse(JSON.stringify({ error: "Failed to connect to SMTP server. Please try again later or check server configuration.", details: errorMessage }), {
          status: 503, // Service Unavailable
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Or your specific frontend origin
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
    }
    return new NextResponse(JSON.stringify({ error: "Failed to send email", details: errorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Or your specific frontend origin
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}
