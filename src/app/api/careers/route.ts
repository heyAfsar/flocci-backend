import { transporter, mailOptions, adminEmail } from '@/lib/nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Define the schema for job application
const careerApplicationSchema = z.object({
  jobId: z.number(),
  candidateName: z.string().min(1, "Name is required"),
  candidateEmail: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  resumeBase64: z.string().min(1, "Resume is required"),
  resumeFileName: z.string().min(1, "Resume filename is required"),
  coverLetter: z.string().optional(),
  jobTitle: z.string().min(1, "Job title is required"),
  companyName: z.string().min(1, "Company name is required"),
  location: z.string().optional(),
  isRemote: z.boolean().optional(),
  jobType: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  requiredSkills: z.array(z.string()).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = careerApplicationSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid input", details: parseResult.error.flatten() }, { status: 400 });
    }

    const {
      jobId,
      candidateName,
      candidateEmail,
      phone,
      resumeBase64,
      resumeFileName,
      coverLetter,
      jobTitle,
      companyName,
      location,
      isRemote,
      jobType,
      salaryMin,
      salaryMax,
      requiredSkills,
    } = parseResult.data;

    // Convert base64 resume to Buffer for attachment
    let resumeBuffer;
    try {
      // First, try to extract the base64 data
      const base64Data = resumeBase64.includes('base64,') 
        ? resumeBase64.split('base64,')[1] 
        : resumeBase64;
        
      if (!base64Data) {
        throw new Error('Invalid base64 data format');
      }

      // Try to create buffer from the base64 data
      resumeBuffer = Buffer.from(base64Data, 'base64');
      
      // Validate if the buffer is not empty
      if (resumeBuffer.length === 0) {
        throw new Error('Empty file content');
      }
    } catch (error) {
      console.error('Error processing resume file:', error);
      return new NextResponse(JSON.stringify({ 
        error: "Failed to process resume file", 
        details: error instanceof Error ? error.message : 'Invalid file format'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Create HTML email content
    const emailHtml = `
      <h1>New Job Application Submission</h1>
      
      <h2>Candidate Information</h2>
      <p><strong>Name:</strong> ${candidateName}</p>
      <p><strong>Email:</strong> ${candidateEmail}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      ${coverLetter ? `<p><strong>Cover Letter:</strong></p><p>${coverLetter.replace(/\n/g, '<br>')}</p>` : ''}
      
      <h2>Job Details</h2>
      <p><strong>Job ID:</strong> ${jobId}</p>
      <p><strong>Position:</strong> ${jobTitle}</p>
      <p><strong>Company:</strong> ${companyName}</p>
      ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
      ${isRemote !== undefined ? `<p><strong>Remote:</strong> ${isRemote ? 'Yes' : 'No'}</p>` : ''}
      ${jobType ? `<p><strong>Job Type:</strong> ${jobType}</p>` : ''}
      ${salaryMin && salaryMax ? `<p><strong>Salary Range:</strong> $${salaryMin.toLocaleString()} - $${salaryMax.toLocaleString()}</p>` : ''}
      ${requiredSkills?.length ? `<p><strong>Required Skills:</strong> ${requiredSkills.join(', ')}</p>` : ''}
    `;

    // Send email with attachment
    const mailOpts = {
      ...mailOptions(adminEmail, `New Job Application from ${candidateName} for ${jobTitle}`, emailHtml),
      attachments: [
        {
          filename: resumeFileName,
          content: resumeBuffer
        }
      ]
    };

    await transporter.sendMail(mailOpts);

    return new NextResponse(JSON.stringify({ message: "Application submitted successfully!" }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (e) {
    console.error("Career application error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    
    // Check if it's a Nodemailer specific error or timeout
    if (e && typeof e === 'object' && 'code' in e) {
      if (e.code === 'ECONNECTION' || e.code === 'ETIMEDOUT') {
        return new NextResponse(JSON.stringify({ 
          error: "Failed to connect to SMTP server. Please try again later or check server configuration.", 
          details: errorMessage 
        }), {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
    }
    
    return new NextResponse(JSON.stringify({ error: "Failed to submit application", details: errorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}
