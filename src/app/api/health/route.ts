import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: "Health check successful",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  }, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json({ 
      message: "Echo test successful",
      received: body,
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
