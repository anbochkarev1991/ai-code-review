# GitHub OAuth Integration Guide

Complete step-by-step guide to set up GitHub OAuth for AI Code Review repository access.

## Prerequisites

- GitHub account
- Backend running on `localhost:3001` (or your configured port)
- Supabase project with `github_connections` table configured

---

## Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** in the left sidebar
3. Click **New OAuth App** (or **Register a new application**)
4. Fill in the application details:
   - **Application name:** `AI Code Review` (or any name you prefer)
   - **Homepage URL:** `http://localhost:3000` (your frontend URL for local dev)
   - **Authorization callback URL:** `http://localhost:3001/github/oauth/callback`
     - **Important:** This must match exactly what's configured in your backend
     - This is where GitHub redirects after user authorization
5. Click **Register application**

---

## Step 2: Get OAuth Credentials

After creating the OAuth App, you'll see a page with your app details:

1. **Copy the Client ID** (visible immediately)
   - Example: `Iv1.8a61f9b3a7ab8b5c`
   - This is public and safe to include in frontend code if needed

2. **Generate a Client Secret:**
   - Click **Generate a new client secret**
   - **Important:** Copy the secret immediately — you won't be able to see it again!
   - Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
   - If you lose it, generate a new one (old one becomes invalid)

---

## Step 3: Configure Environment Variables

Add these to your `backend/.env` file:

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=Iv1.8a61f9b3a7ab8b5c
GITHUB_CLIENT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/github/oauth/callback

# Frontend URL (optional, defaults to http://localhost:3000)
FRONTEND_URL=http://localhost:3000
```

**Replace:**
- `Iv1.8a61f9b3a7ab8b5c` with your actual Client ID from Step 2
- `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` with your actual Client Secret from Step 2
- `http://localhost:3001/github/oauth/callback` should match your backend port (default: 3001)
- `http://localhost:3000` should match your frontend port (default: 3000)

**Important:** Never commit your `.env` file to git! The `.env.example` file contains placeholders for reference.

---

## Step 4: Verify Configuration

### 4.1 Check Environment Variables

Ensure all GitHub OAuth variables are set in `backend/.env`:

```bash
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxx
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/github/oauth/callback
FRONTEND_URL=http://localhost:3000
```

### 4.2 Restart Backend

After updating `.env`, restart your backend server:

```bash
cd backend
npm run start:dev
```

The backend must be restarted for environment variable changes to take effect.

### 4.3 Verify Backend Endpoints

Your backend should expose these endpoints:

- `GET /github/oauth` — Initiates OAuth flow (redirects to GitHub)
- `GET /github/oauth/callback` — Handles GitHub callback with authorization code

You can verify the OAuth endpoint is working by visiting:
```
http://localhost:3001/github/oauth
```

This should redirect you to GitHub's authorization page (not a 404 error).

---

## Step 5: Test OAuth Flow

### 5.1 Test from Frontend

1. Log in to your app (via Supabase Auth)
2. Navigate to Dashboard
3. Click **Connect GitHub** (or similar button that triggers OAuth)
4. You should be redirected to GitHub authorization page
5. Click **Authorize** (or your app name)
6. You should be redirected back to your app with `?github=connected` in the URL

### 5.2 Verify Database Entry

After successful connection, check your Supabase `github_connections` table:

1. Go to Supabase Dashboard → **Table Editor** → `github_connections`
2. You should see a new row with:
   - `user_id`: Your Supabase user ID
   - `github_user_id`: Your GitHub user ID
   - `access_token`: Encrypted/stored GitHub access token
   - `created_at`: Timestamp

### 5.3 Test Repository Access

After connecting GitHub, test that repository access works:

1. In your Dashboard, try to fetch repositories
2. The backend should use the stored access token to call GitHub API
3. You should see your repositories listed

---

## Troubleshooting

### Error: "404 Not Found" when accessing `/github/oauth`

- **Cause:** `GITHUB_CLIENT_ID` is missing, incorrect, or still has placeholder value (`your_github_client_id`)
- **Fix:**
  1. Verify `GITHUB_CLIENT_ID` in `backend/.env` matches your GitHub OAuth App Client ID
  2. Ensure there are no extra spaces or quotes around the value
  3. Restart backend after updating `.env`
  4. Check that the URL shows your actual Client ID, not `your_github_client_id`

### Error: "GitHub OAuth is not configured"

- **Cause:** Missing environment variables (`GITHUB_CLIENT_ID` or `GITHUB_OAUTH_REDIRECT_URI`)
- **Fix:**
  1. Check `backend/.env` has all required variables
  2. Ensure variable names match exactly (case-sensitive)
  3. Restart backend after adding variables

### Error: "redirect_uri_mismatch" from GitHub

- **Cause:** Authorization callback URL in GitHub OAuth App doesn't match `GITHUB_OAUTH_REDIRECT_URI` in `.env`
- **Fix:**
  1. Go to GitHub → Settings → Developer settings → OAuth Apps → Your App
  2. Verify **Authorization callback URL** matches exactly:
     ```
     http://localhost:3001/github/oauth/callback
     ```
  3. Update GitHub OAuth App if needed
  4. Ensure `GITHUB_OAUTH_REDIRECT_URI` in `.env` matches exactly (including `http://` vs `https://`, port number, trailing slashes)

### Error: "Failed to exchange code for token"

- **Cause:** `GITHUB_CLIENT_SECRET` is incorrect or missing
- **Fix:**
  1. Verify `GITHUB_CLIENT_SECRET` in `backend/.env` matches your GitHub OAuth App secret
  2. If you lost the secret, generate a new one in GitHub OAuth App settings
  3. Update `.env` and restart backend

### OAuth Flow Redirects but No Database Entry

- **Cause:** Supabase configuration issue or database permissions
- **Fix:**
  1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `backend/.env`
  2. Check backend logs for Supabase errors
  3. Verify `github_connections` table exists and has correct schema
  4. Check that RLS (Row Level Security) policies allow inserts/updates

### "Invalid state" Error

- **Cause:** State parameter mismatch (used for CSRF protection)
- **Fix:**
  1. Ensure frontend passes a valid state parameter (usually user's Supabase session token)
  2. Check that state is preserved through the OAuth redirect flow
  3. Verify frontend URL matches `FRONTEND_URL` in backend `.env`

---

## OAuth Scopes Explained

Your app requests these GitHub OAuth scopes:

- `read:user` — Read user profile information
- `repo` — Full repository access (read and write)

**Note:** The `repo` scope is broad and grants access to all repositories the user can access. For production, consider requesting more granular scopes if you only need read access.

---

## Production Checklist

Before deploying to production:

- [ ] Create a **new GitHub OAuth App** for production (don't reuse dev app)
- [ ] Set **Homepage URL** to your production frontend URL (e.g., `https://yourdomain.com`)
- [ ] Set **Authorization callback URL** to your production backend URL:
  ```
  https://api.yourdomain.com/github/oauth/callback
  ```
- [ ] Copy production **Client ID** and **Client Secret**
- [ ] Update production environment variables:
  - `GITHUB_CLIENT_ID` (production app)
  - `GITHUB_CLIENT_SECRET` (production app)
  - `GITHUB_OAUTH_REDIRECT_URI` (production callback URL)
  - `FRONTEND_URL` (production frontend URL)
- [ ] Test OAuth flow in production environment
- [ ] Verify database entries are created correctly
- [ ] Consider using more restrictive OAuth scopes if you don't need full `repo` access

---

## Security Best Practices

1. **Never commit secrets:** Keep `.env` files out of git (use `.gitignore`)
2. **Use separate OAuth Apps:** One for development, one for production
3. **Rotate secrets:** If a secret is exposed, regenerate it immediately in GitHub
4. **Monitor access:** Review GitHub OAuth App settings periodically
5. **Limit scopes:** Request only the minimum scopes needed for your app
6. **Store tokens securely:** Access tokens are stored encrypted in Supabase (via your backend)

---

## Additional Resources

- [GitHub OAuth Apps Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub OAuth Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [GitHub API Documentation](https://docs.github.com/en/rest)
