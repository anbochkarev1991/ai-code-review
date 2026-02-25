# Supabase Setup (Day 1 — Tasks 1.4, 1.5)

## 1.4 — Create project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project (or use existing)
3. Note your **Project URL** and **anon/public key** from Settings → API
4. Copy `backend/.env.example` to `backend/.env` and fill in values
5. Copy `frontend/.env.example` to `frontend/.env.local` and fill in values

**Verify:** Project exists; you can open the Supabase dashboard.

## 1.5 — Enable Auth providers (Google + Microsoft)

### Google OAuth Setup

1. **In Google Cloud Console** ([console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)):
   - Create OAuth 2.0 Client ID credentials (or use existing)
   - **Important:** Add the Supabase callback URL to **Authorized redirect URIs**:
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
     - Replace `<your-project-ref>` with your actual Supabase project reference (found in Supabase dashboard → Settings → API → Project URL)
   - Copy the **Client ID** and **Client Secret**

2. **In Supabase dashboard** → **Authentication** → **Providers**:
   - Enable **Google**
   - Paste the **Client ID** and **Client Secret** from Google Cloud Console
   - Configure **Redirect URLs** (where Supabase redirects after OAuth):
     - `http://localhost:3000/auth/callback` (dev)
     - Your production URL when deployed (e.g., `https://yourdomain.com/auth/callback`)

### Microsoft OAuth Setup

1. **In Azure Portal** ([portal.azure.com](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)):
   - Create or select an app registration
   - Add the Supabase callback URL to **Redirect URIs**:
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
   - Copy the **Application (client) ID** and create a **Client Secret**

2. **In Supabase dashboard** → **Authentication** → **Providers**:
   - Enable **Microsoft**
   - Paste the **Application (client) ID** and **Client Secret** from Azure Portal
   - Configure **Redirect URLs**:
     - `http://localhost:3000/auth/callback` (dev)
     - Your production URL when deployed

**Verify:** Sign-in with Google/Microsoft works in Supabase Auth UI (Authentication → Users → "Add user" → "Sign in with OAuth").
