import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach((cookie: { name: string; value: string; options?: object }) =>
              cookieStore.set(cookie.name, cookie.value, cookie.options)
            );
          } catch {
            // setAll called from a Server Component — ignored if middleware refreshes sessions
          }
        },
      },
    }
  );
}
