import { NextResponse } from "next/server";

export const runtime = "nodejs";

const serviceUnavailable = () => NextResponse.json(
  { error: { code: "voice_unconfigured", message: "Voice service is not configured." } },
  { status: 503 },
);

const upstreamFailure = () => NextResponse.json(
  { error: { code: "voice_unavailable", message: "Voice service is temporarily unavailable." } },
  { status: 502 },
);

export async function GET() {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) return serviceUnavailable();

  try {
    const response = await fetch("https://agents.assemblyai.com/v1/token?expires_in_seconds=300", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) return upstreamFailure();

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || typeof (payload as { token?: unknown }).token !== "string") return upstreamFailure();
    return NextResponse.json({ token: (payload as { token: string }).token });
  } catch {
    return upstreamFailure();
  }
}
