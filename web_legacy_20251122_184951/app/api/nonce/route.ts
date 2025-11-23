import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  return NextResponse.json({ nonce });
}
