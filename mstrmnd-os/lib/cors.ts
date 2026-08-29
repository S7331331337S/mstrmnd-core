import { NextResponse } from "next/server";

/** Board (Expo web) calls OS from another origin. Native has no CORS. */
export function withCors(res: NextResponse): NextResponse {
  const origin = process.env.BOARD_CORS_ORIGIN ?? "*";
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Mstrmnd-Client",
  );
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return res;
}

export function corsPreflight(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}
