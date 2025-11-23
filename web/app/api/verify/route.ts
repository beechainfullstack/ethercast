import { NextRequest, NextResponse } from "next/server";
import {
  verifyCloudProof,
  type IVerifyResponse,
  type ISuccessResult,
} from "@worldcoin/minikit-js";

interface IRequestPayload {
  payload: ISuccessResult;
  action: string;
  signal: string | undefined;
}

export async function POST(req: NextRequest) {
  try {
    const { payload, action, signal } = (await req.json()) as IRequestPayload;

    const appId = process.env.APP_ID as `app_${string}` | undefined;

    if (!appId) {
      return NextResponse.json(
        { error: "APP_ID is not configured on the server" },
        { status: 500 },
      );
    }

    const verifyRes = (await verifyCloudProof(
      payload,
      appId,
      action,
      signal,
    )) as IVerifyResponse;

    if (verifyRes.success) {
      // place for backend side-effects (e.g. mark user as verified, trigger tx, etc.)
      return NextResponse.json({ verifyRes }, { status: 200 });
    }

    return NextResponse.json({ verifyRes }, { status: 400 });
  } catch (error) {
    console.error("/api/verify error", error);
    return NextResponse.json(
      { error: "unable to verify proof" },
      { status: 500 },
    );
  }
}