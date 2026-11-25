import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const AUTH_COOKIE = "brand_sys_session";

async function hasValidToken(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = await hasValidToken(req);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(authed ? "/products" : "/login", req.url));
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/login")) {
    if (authed && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/products", req.url));
    }
    return NextResponse.next();
  }

  if (!authed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};