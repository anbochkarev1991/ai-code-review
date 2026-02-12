# Supabase Setup (Day 1 — Tasks 1.4, 1.5)

## 1.4 — Create project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project (or use existing)
3. Note your **Project URL** and **anon/public key** from Settings → API
4. Copy `backend/.env.example` to `backend/.env` and fill in values
5. Copy `frontend/.env.example` to `frontend/.env.local` and fill in values

**Verify:** Project exists; you can open the Supabase dashboard.

## 1.5 — Enable Auth providers (Google + Microsoft)

1. In Supabase dashboard: **Authentication** → **Providers**
2. Enable **Google** — add OAuth Client ID and Secret from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
3. Enable **Microsoft** — add Application (client) ID and Secret from [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
4. Add redirect URLs: `http://localhost:3000/auth/callback` (dev) and your production URL when deployed

**Verify:** Sign-in with Google/Microsoft works in Supabase Auth UI ( Authentication → Users → "Add user" → "Sign in with OAuth").
