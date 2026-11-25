import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, signSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const expectedUser = process.env.ADMIN_USER;
    const expectedPass = process.env.ADMIN_PASS;

    if (!expectedUser || !expectedPass) {
      return NextResponse.json(
        { error: "ADMIN_USER أو ADMIN_PASS غير مضبوط في ملف .env" },
        { status: 500 }
      );
    }

    if (username !== expectedUser || password !== expectedPass) {
      return NextResponse.json(
        { error: "اسم المستخدم أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    const token = await signSession(username);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "حدث خطأ أثناء تسجيل الدخول" }, { status: 500 });
  }
}