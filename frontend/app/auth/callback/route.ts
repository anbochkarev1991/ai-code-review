import { createClient } from "@/lib/supabase/server";
import { getSafeRelativeRedirectPath } from "@/lib/redirect-validation";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRelativeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const dest = new URL(next, origin).toString();
      return NextResponse.redirect(dest);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
