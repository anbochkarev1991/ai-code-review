# Koyeb Deployment Guide

Complete step-by-step guide to deploy the backend to Koyeb.

## Prerequisites

- Koyeb account (create at [koyeb.com](https://koyeb.com))
- GitHub repository connected to Koyeb
- All environment variables ready (see `backend/.env.example`)
- Supabase project configured (see `docs/SUPABASE_SETUP.md`)
- Stripe account configured (see `docs/STRIPE_SETUP.md`)
- GitHub OAuth app configured (see `docs/GITHUB_SETUP.md`)

---

## Problem: Build Order Issue

The backend depends on the `shared` package (monorepo structure). Koyeb needs to build `shared` first, then the backend, to avoid TypeScript errors:

```
TS2307: Cannot find module 'shared' or its corresponding type declarations.
```

## Solution

Configure Koyeb to build `shared` first, then the backend. A `Procfile` has been created to handle the start command, and build scripts are configured in the root `package.json`.

---

## Step 1: Configuration Files

**Important:** The following files have been created for Koyeb deployment:

- **`Procfile`**: Specifies the command to run the application (`web: cd backend && npm run start:prod`)
- **`package.json`** (root): Contains build scripts that build `shared` first, then `backend`

---

## Step 2: Create Koyeb Service

1. Go to [Koyeb Dashboard](https://app.koyeb.com/)
2. Sign up or log in with GitHub
3. Click **Create Service** or **New Service**
4. Select **GitHub** as your source
5. Connect your GitHub account if needed
6. Select the `ai-code-review` repository
7. Select the branch you want to deploy (usually `main` or `master`)

---

## Step 3: Configure Build Settings

### 3.1 Set Root Directory

1. In the **Build** section, **leave Root Directory empty** (or set to `/`)
   - **Important:** Do NOT set Root Directory to `backend`
   - Koyeb needs access to both `shared/` and `backend/` directories
   - Koyeb will detect the root `package.json` and `Procfile` automatically

### 3.2 Configure Build Command

1. In the **Build** section, set **Build Command** to:
   ```bash
   npm run build
   ```
   - This uses the root `package.json` script that builds `shared` first, then `backend`
   - The build process:
     1. Installs `shared` dependencies and builds it
     2. Installs `backend` dependencies and builds it

**Alternative:** If you prefer explicit commands:
   ```bash
   cd shared && npm install && npm run build && cd ../backend && npm install && npx nest build
   ```

### 3.3 Configure Run Command

**Option A: Using Procfile (Recommended - Auto-detected)**

Koyeb will automatically detect the `Procfile` and use:
- **Run Command:** `cd backend && npm run start:prod`
- No manual configuration needed

**Option B: Manual Configuration**

1. In the **Run** section, set **Run Command** to:
   ```bash
   cd backend && npm run start:prod
   ```
   - Or use: `npm run start:backend` (from root `package.json`)
   - This navigates to `backend/` directory and runs `node dist/main` (production mode)

### 3.4 Set Node Version (Optional)

1. In the **Build** section, you can specify Node version
2. Set **Node Version** to `22` (or your preferred version)
   - Koyeb will use this Node version for builds
   - Check your local Node version: `node --version`

---

## Step 4: Configure Environment Variables

Go to **Variables** tab and add all required environment variables:

### Server
- `PORT` - Koyeb will set this automatically, but you can override if needed
  - Default: Koyeb assigns a port automatically (usually `8080`)

### Supabase
- `SUPABASE_URL` - Your Supabase project URL
  - Format: `https://xxxxx.supabase.co`
  - Found in: Supabase Dashboard → Settings → API → Project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
  - Found in: Supabase Dashboard → Settings → API → Project API keys → `anon` `public`
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for webhooks)
  - Found in: Supabase Dashboard → Settings → API → Project API keys → `service_role` `secret`
  - **Important:** Keep this secret - it bypasses Row Level Security

### GitHub OAuth
- `GITHUB_CLIENT_ID` - Your GitHub OAuth app client ID
  - Found in: GitHub → Settings → Developer settings → OAuth Apps → Your App
- `GITHUB_CLIENT_SECRET` - Your GitHub OAuth app client secret
  - Found in: Same location as Client ID → Generate new client secret
- `GITHUB_OAUTH_REDIRECT_URI` - Set to `https://<your-koyeb-domain>/github/oauth/callback`
  - Replace `<your-koyeb-domain>` with your Koyeb service URL (e.g., `https://your-app.koyeb.app`)
  - **Important:** Also update this URL in your GitHub OAuth app settings

### Frontend URL
- `FRONTEND_URL` - Your frontend URL
  - Example: `https://your-app.vercel.app` (if deployed on Vercel)
  - Used for CORS and OAuth redirects
- `CORS_ORIGINS` - (Optional) Comma-separated list of allowed origins
  - Example: `https://your-app.vercel.app,https://www.your-app.com`
  - If not set, defaults to `FRONTEND_URL`

### Stripe
- `STRIPE_SECRET_KEY` - Your Stripe secret key
  - Test mode: starts with `sk_test_`
  - Live mode: starts with `sk_live_`
  - Found in: Stripe Dashboard → Developers → API keys → Secret key
- `STRIPE_PRO_PRICE_ID` - Your Stripe Pro price ID
  - Format: starts with `price_`
  - Found in: Stripe Dashboard → Products → Your Product → Pricing
- `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook signing secret
  - Format: starts with `whsec_`
  - **Important:** Register webhook URL first (see Step 7), then copy the signing secret

### OpenAI
- `OPENAI_API_KEY` - Your OpenAI API key
  - Format: starts with `sk-`
  - Found in: [OpenAI Platform](https://platform.openai.com/api-keys)
- `OPENAI_MODEL` - (Optional) Model to use
  - Default: `gpt-4o-mini`
  - Options: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, etc.
- `USE_MOCK_OPENAI_RESPONSES` - (Optional) Set to `true` for testing without OpenAI API
  - Default: `false`
  - Use only for testing/demo purposes

---

## Step 5: Deploy

1. Click **Deploy** to start the deployment
2. Koyeb will automatically:
   - Clone your repository
   - Run the build command
   - Start the application using the Procfile or run command
3. Watch the build logs to ensure:
   - `shared` package builds successfully
   - `backend` package builds successfully
   - No TypeScript errors
   - Application starts without errors

### Build Process

The build will:
1. Navigate to `shared/` directory
2. Install dependencies (`npm install`)
3. Build shared package (`npm run build`)
4. Navigate to `backend/` directory
5. Install dependencies (`npm install`)
6. Build backend (`npx nest build`)

---

## Step 6: Verify Deployment

### 6.1 Check Health Endpoint

Once deployed, Koyeb will provide a public URL (e.g., `https://your-app.koyeb.app`).

Test the health endpoint:
```bash
curl https://your-app.koyeb.app/health
```

Expected response:
```json
{"status":"ok"}
```

### 6.2 Check Logs

1. Go to **Logs** tab in Koyeb dashboard
2. Check for any errors:
   - Missing environment variables → Check **Variables** tab
   - Build failures → Check build logs for TypeScript errors
   - Runtime errors → Check application logs
   - Port binding errors → Check `PORT` environment variable

### 6.3 Test API Endpoints

Test other endpoints to ensure the backend is working:

```bash
# Health check
curl https://your-app.koyeb.app/health

# Check CORS (should allow your frontend origin)
curl -H "Origin: https://your-frontend.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://your-app.koyeb.app/health
```

---

## Step 7: Configure Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/) → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set **Endpoint URL** to: `https://<your-koyeb-domain>/billing/webhook`
   - Replace `<your-koyeb-domain>` with your Koyeb service URL
   - Example: `https://your-app.koyeb.app/billing/webhook`
4. Select events to listen to:
   - `checkout.session.completed` - When a customer completes checkout
   - `customer.subscription.updated` - When a subscription is updated
   - `customer.subscription.deleted` - When a subscription is cancelled
   - `invoice.payment_succeeded` - When a payment succeeds
   - `invoice.payment_failed` - When a payment fails
5. Click **Add endpoint**
6. **Copy the Signing secret** (starts with `whsec_`)
7. Add it to Koyeb **Variables** as `STRIPE_WEBHOOK_SECRET`
8. **Important:** After adding the secret, restart your Koyeb service

---

## Step 8: Update GitHub OAuth App

1. Go to GitHub → Settings → Developer settings → OAuth Apps → Your App
2. Update **Authorization callback URL** to:
   ```
   https://<your-koyeb-domain>/github/oauth/callback
   ```
3. Save changes
4. Ensure `GITHUB_OAUTH_REDIRECT_URI` in Koyeb matches this URL

---

## Troubleshooting

### Error: "no command to run your application"

**Symptoms:**
```
ERROR: no command to run your application: add a run command in your Service configuration or create a Procfile
```

**Solution:**
1. Ensure `Procfile` exists in the repository root with:
   ```
   web: cd backend && npm run start:prod
   ```
2. Or manually set **Run Command** in Koyeb dashboard:
   ```
   cd backend && npm run start:prod
   ```
3. Verify the Procfile is committed to git and pushed to your repository

### Build Fails: "Cannot find module 'shared'"

**Symptoms:**
```
TS2307: Cannot find module 'shared' or its corresponding type declarations.
```

**Solution:** 
1. **Ensure Root Directory is empty** (repo root), NOT set to `backend`
2. Verify the build command builds `shared` first:
   ```bash
   npm run build
   ```
3. Check Koyeb build logs to ensure `shared` builds before `backend`
4. Verify `shared/package.json` exists and has a `build` script
5. Ensure both `shared/` and `backend/` directories are accessible in the build context

### Build Fails: "can't cd to ../shared"

**Symptoms:**
```
sh: 1: cd: can't cd to ../shared
```

**Solution:**
1. **Root Directory must be empty** (repo root), NOT set to `backend`
2. Update Build Command to use relative paths from root:
   ```bash
   npm run build
   ```
3. Or explicitly:
   ```bash
   cd shared && npm install && npm run build && cd ../backend && npm install && npx nest build
   ```
4. Do NOT use `../shared` - use `shared` since you're starting from repo root

### TypeScript Errors During Build

**Solution:** 
1. Check that `shared` package builds successfully (look for `shared/dist/` directory)
2. Verify `shared/package.json` has correct `main` and `types` fields:
   ```json
   {
     "main": "dist/index.js",
     "types": "dist/index.d.ts"
   }
   ```
3. Ensure `backend/package.json` has `"shared": "file:../shared"` dependency
4. Check that TypeScript versions are compatible between `shared` and `backend`

### Runtime Error: "Cannot find module"

**Symptoms:**
```
Error: Cannot find module 'shared'
```

**Solution:**
1. Ensure `shared` is built before backend (check build logs)
2. Verify `shared/dist/index.js` exists after build
3. Check that `shared/dist/index.d.ts` exists for TypeScript types
4. Restart Koyeb service after fixing build issues

### Environment Variables Not Found

**Symptoms:**
```
Error: Configuration validation error: SUPABASE_URL is required
```

**Solution:**
1. Check **Variables** tab in Koyeb
2. Ensure all required variables are set (see Step 4)
3. Verify variable names match exactly (case-sensitive)
4. Restart the service after adding variables
5. Check for typos or extra spaces

### CORS Errors

**Symptoms:**
```
Access to fetch at 'https://your-backend.koyeb.app/...' from origin 'https://your-frontend.vercel.app' has been blocked by CORS policy
```

**Solution:**
1. Set `FRONTEND_URL` in Koyeb variables to your frontend URL
2. Or set `CORS_ORIGINS` with comma-separated list of allowed origins
3. Ensure frontend URL matches exactly (including protocol: `https://`)
4. Check backend logs for CORS configuration
5. Verify `main.ts` has CORS enabled (should be enabled by default)

### Port Binding Error

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution:**
1. Remove `PORT` from Koyeb variables (Koyeb sets it automatically)
2. Or set `PORT` to Koyeb's `$PORT` environment variable
3. Ensure backend uses `process.env.PORT ?? 3001` (should be default)
4. Koyeb typically uses port `8080` by default

### Stripe Webhook Not Receiving Events

**Symptoms:**
- Webhook events not appearing in backend logs
- Subscriptions not updating in database

**Solution:**
1. Verify webhook URL is correct in Stripe Dashboard
2. Check `STRIPE_WEBHOOK_SECRET` is set correctly in Koyeb
3. Ensure webhook endpoint is accessible: `https://your-app.koyeb.app/billing/webhook`
4. Check Stripe Dashboard → Webhooks → Your endpoint → Recent events
5. Verify webhook events are selected correctly
6. Test webhook locally first using Stripe CLI

### Build Takes Too Long

**Solution:**
1. Consider caching `node_modules` (Koyeb may do this automatically)
2. Ensure `.gitignore` excludes `node_modules/` and `dist/`
3. Check build logs for slow steps
4. Consider using Koyeb's build cache if available

---

## Production Checklist

Before going live, verify:

- [ ] Koyeb service created and connected to GitHub
- [ ] Root directory left empty (repo root) - **NOT set to `backend`**
- [ ] Build command configured to build `shared` first, then `backend`
- [ ] Run command set (via Procfile or manual): `cd backend && npm run start:prod`
- [ ] All environment variables added
- [ ] `FRONTEND_URL` set to production frontend URL
- [ ] `GITHUB_OAUTH_REDIRECT_URI` updated to production URL
- [ ] Stripe webhook URL registered in Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` added to Koyeb variables
- [ ] GitHub OAuth app callback URL updated
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] Backend accessible from frontend (no CORS errors)
- [ ] Stripe webhook receives test events
- [ ] All API endpoints working correctly
- [ ] Logs show no errors

---

## Additional Resources

- [Koyeb Documentation](https://www.koyeb.com/docs)
- [Koyeb Environment Variables](https://www.koyeb.com/docs/getting-started/environment-variables)
- [Koyeb Build Configuration](https://www.koyeb.com/docs/getting-started/build-configuration)
- [NestJS Deployment](https://docs.nestjs.com/deployment)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)

---

## Related Documentation

- [Supabase Setup Guide](./SUPABASE_SETUP.md)
- [Stripe Setup Guide](./STRIPE_SETUP.md)
- [GitHub Setup Guide](./GITHUB_SETUP.md)
- [Railway Deployment Guide](./RAILWAY_DEPLOYMENT.md) (alternative deployment option)
