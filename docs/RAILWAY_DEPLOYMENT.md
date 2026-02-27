# Railway Deployment Guide

Complete step-by-step guide to deploy the backend to Railway.

## Prerequisites

- Railway account (create at [railway.app](https://railway.app))
- GitHub repository connected to Railway
- All environment variables ready (see `backend/.env.example`)
- Supabase project configured (see `docs/SUPABASE_SETUP.md`)
- Stripe account configured (see `docs/STRIPE_SETUP.md`)
- GitHub OAuth app configured (see `docs/GITHUB_SETUP.md`)

---

## Problem: Build Order Issue

The backend depends on the `shared` package (monorepo structure). Railway tries to build the backend before `shared` is built, causing TypeScript errors:

```
TS2307: Cannot find module 'shared' or its corresponding type declarations.
```

## Solution

Configure Railway to build `shared` first, then the backend. The backend `package.json` build script has been updated to handle this automatically.

---

## Step 1: Update Backend Build Script

**Important:** Ensure `backend/package.json` has the updated build script:

```json
{
  "scripts": {
    "build": "cd ../shared && npm install && npm run build && cd ../backend && npm install && nest build",
    ...
  }
}
```

This ensures `shared` is built before the backend.

---

## Step 2: Create Railway Project

1. Go to [Railway.app](https://railway.app/)
2. Sign up or log in with GitHub
3. Click **New Project**
4. Select **Deploy from GitHub repo**
5. Connect your GitHub account if needed
6. Select the `ai-code-review` repository
7. Railway will detect it's a Node.js project

---

## Step 3: Configure Railway Service

### 3.1 Set Root Directory

1. In your Railway project, go to **Settings**
2. Under **Root Directory**, set: `backend`
   - This tells Railway to run commands from the `backend/` directory
   - Railway will look for `package.json` in the `backend/` folder

### 3.2 Configure Build Command

1. Go to **Settings** → **Build & Deploy**
2. Set **Build Command** to:
   ```bash
   npm run build
   ```
   - This uses the updated build script in `package.json` that builds `shared` first

**Alternative:** If you prefer to set it explicitly in Railway:
   ```bash
   cd ../shared && npm install && npm run build && cd ../backend && npm install && npm run build
   ```

### 3.3 Configure Start Command

1. Under **Start Command**, set:
   ```bash
   npm run start:prod
   ```
   - This runs `node dist/main` (production mode)

### 3.4 Set Node Version (Optional)

1. In **Settings** → **Build & Deploy**
2. Set **Node Version** to `22` (or your preferred version)
   - Railway will use this Node version for builds
   - Check your local Node version: `node --version`

---

## Step 4: Configure Environment Variables

Go to **Variables** tab and add all required environment variables:

### Server
- `PORT` - Railway will set this automatically, but you can override if needed
  - Default: Railway assigns a port automatically

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
- `GITHUB_OAUTH_REDIRECT_URI` - Set to `https://<your-railway-domain>/github/oauth/callback`
  - Replace `<your-railway-domain>` with your Railway service URL (e.g., `https://your-app.up.railway.app`)
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

1. Railway will automatically deploy when you push to your connected branch
2. Or click **Deploy** → **Deploy Now** to trigger a manual deployment
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
4. Navigate back to `backend/` directory
5. Install dependencies (`npm install`)
6. Build backend (`nest build`)

---

## Step 6: Verify Deployment

### 6.1 Check Health Endpoint

Once deployed, Railway will provide a public URL (e.g., `https://your-app.up.railway.app`).

Test the health endpoint:
```bash
curl https://your-app.up.railway.app/health
```

Expected response:
```json
{"status":"ok"}
```

### 6.2 Check Logs

1. Go to **Deployments** tab
2. Click on the latest deployment
3. Check **View logs** for any errors
4. Common issues:
   - Missing environment variables → Check **Variables** tab
   - Build failures → Check build logs for TypeScript errors
   - Runtime errors → Check application logs
   - Port binding errors → Check `PORT` environment variable

### 6.3 Test API Endpoints

Test other endpoints to ensure the backend is working:

```bash
# Health check
curl https://your-app.up.railway.app/health

# Check CORS (should allow your frontend origin)
curl -H "Origin: https://your-frontend.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://your-app.up.railway.app/health
```

---

## Step 7: Configure Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/) → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set **Endpoint URL** to: `https://<your-railway-domain>/billing/webhook`
   - Replace `<your-railway-domain>` with your Railway service URL
   - Example: `https://your-app.up.railway.app/billing/webhook`
4. Select events to listen to:
   - `checkout.session.completed` - When a customer completes checkout
   - `customer.subscription.updated` - When a subscription is updated
   - `customer.subscription.deleted` - When a subscription is cancelled
   - `invoice.payment_succeeded` - When a payment succeeds
   - `invoice.payment_failed` - When a payment fails
5. Click **Add endpoint**
6. **Copy the Signing secret** (starts with `whsec_`)
7. Add it to Railway **Variables** as `STRIPE_WEBHOOK_SECRET`
8. **Important:** After adding the secret, restart your Railway service

---

## Step 8: Update GitHub OAuth App

1. Go to GitHub → Settings → Developer settings → OAuth Apps → Your App
2. Update **Authorization callback URL** to:
   ```
   https://<your-railway-domain>/github/oauth/callback
   ```
3. Save changes
4. Ensure `GITHUB_OAUTH_REDIRECT_URI` in Railway matches this URL

---

## Troubleshooting

### Build Fails: "Cannot find module 'shared'"

**Symptoms:**
```
TS2307: Cannot find module 'shared' or its corresponding type declarations.
```

**Solution:** 
1. Verify `backend/package.json` has the updated build script:
   ```json
   "build": "cd ../shared && npm install && npm run build && cd ../backend && npm install && nest build"
   ```
2. Check Railway build logs to ensure `shared` builds before `backend`
3. Verify `shared/package.json` exists and has a `build` script
4. Ensure Root Directory is set to `backend` in Railway settings

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
4. Restart Railway service after fixing build issues

### Environment Variables Not Found

**Symptoms:**
```
Error: Configuration validation error: SUPABASE_URL is required
```

**Solution:**
1. Check **Variables** tab in Railway
2. Ensure all required variables are set (see Step 4)
3. Verify variable names match exactly (case-sensitive)
4. Restart the service after adding variables
5. Check for typos or extra spaces

### CORS Errors

**Symptoms:**
```
Access to fetch at 'https://your-backend.railway.app/...' from origin 'https://your-frontend.vercel.app' has been blocked by CORS policy
```

**Solution:**
1. Set `FRONTEND_URL` in Railway variables to your frontend URL
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
1. Remove `PORT` from Railway variables (Railway sets it automatically)
2. Or set `PORT` to Railway's `$PORT` environment variable
3. Ensure backend uses `process.env.PORT ?? 3001` (should be default)

### Stripe Webhook Not Receiving Events

**Symptoms:**
- Webhook events not appearing in backend logs
- Subscriptions not updating in database

**Solution:**
1. Verify webhook URL is correct in Stripe Dashboard
2. Check `STRIPE_WEBHOOK_SECRET` is set correctly in Railway
3. Ensure webhook endpoint is accessible: `https://your-app.railway.app/billing/webhook`
4. Check Stripe Dashboard → Webhooks → Your endpoint → Recent events
5. Verify webhook events are selected correctly
6. Test webhook locally first using Stripe CLI

### Build Takes Too Long

**Solution:**
1. Consider caching `node_modules` (Railway may do this automatically)
2. Ensure `.gitignore` excludes `node_modules/` and `dist/`
3. Check build logs for slow steps
4. Consider using Railway's build cache if available

---

## Production Checklist

Before going live, verify:

- [ ] Railway project created and connected to GitHub
- [ ] Root directory set to `backend`
- [ ] Build command configured correctly
- [ ] Start command set to `npm run start:prod`
- [ ] All environment variables added
- [ ] `FRONTEND_URL` set to production frontend URL
- [ ] `GITHUB_OAUTH_REDIRECT_URI` updated to production URL
- [ ] Stripe webhook URL registered in Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` added to Railway variables
- [ ] GitHub OAuth app callback URL updated
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] Backend accessible from frontend (no CORS errors)
- [ ] Stripe webhook receives test events
- [ ] All API endpoints working correctly
- [ ] Logs show no errors

---

## Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [Railway Build Configuration](https://docs.railway.app/develop/builds)
- [NestJS Deployment](https://docs.nestjs.com/deployment)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)

---

## Related Documentation

- [Supabase Setup Guide](./SUPABASE_SETUP.md)
- [Stripe Setup Guide](./STRIPE_SETUP.md)
- [GitHub Setup Guide](./GITHUB_SETUP.md)
