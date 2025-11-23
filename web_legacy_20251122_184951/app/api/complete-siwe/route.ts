import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";

export async function POST(req: NextRequest) {
  try {
    const { payload, nonce } = (await req.json()) as {
      payload: {
        status: string;
        message: string;
        signature: string;
        address: string;
      };
      nonce: string;
    };

    if (!payload || !nonce) {
      return NextResponse.json({ ok: false, error: "invalid-nonce-or-payload" }, { status: 400 });
    }

    if (payload.status !== "success") {
      return NextResponse.json({ ok: false, error: "wallet-auth-error" }, { status: 400 });
    }

    const { message, signature, address } = payload;
    if (!message || !signature || !address) {
      return NextResponse.json({ ok: false, error: "missing-fields" }, { status: 400 });
    }

    const siweMessage = new SiweMessage(message);
    await siweMessage.verify({ signature, nonce });

    return NextResponse.json({ ok: true, address });
  } catch (err) {
    console.error("/api/complete-siwe error", err);
    return NextResponse.json({ ok: false, error: "internal-error" }, { status: 500 });
  }
}
