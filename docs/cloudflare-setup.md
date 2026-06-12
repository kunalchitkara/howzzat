# Howzzat — Cloudflare + howzzat.uk setup

Landing site lives in `apps/landing/public`. The app deploys separately to `app.howzzat.uk`.

## What you do once (≈15 min)

### 1. Add domain to Cloudflare

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site** → `howzzat.uk`
2. Choose **Free** plan
3. Cloudflare shows **two nameservers** (e.g. `ada.ns.cloudflare.com`)

### 2. Point Squarespace DNS to Cloudflare

1. Squarespace → **Settings → Domains → howzzat.uk**
2. **DNS / Nameservers** → **Use custom nameservers**
3. Paste Cloudflare’s two nameservers → Save
4. Wait up to 24h (often &lt;1h) until Cloudflare shows **Active**

You can **cancel the Squarespace website plan** — only domain registration is needed.

### 3. Deploy the landing page

On your machine (after [Wrangler login](https://developers.cloudflare.com/workers/wrangler/commands/#login)):

```bash
cd /path/to/howzzat
pnpm landing:deploy
```

Or:

```bash
npx wrangler login
pnpm --filter @howzzat/landing deploy
```

### 4. Attach howzzat.uk to Pages

1. Cloudflare → **Workers & Pages** → project **howzzat-landing**
2. **Custom domains** → **Set up a domain** → `howzzat.uk` and `www.howzzat.uk`
3. Cloudflare creates DNS records automatically

Stripe website URL: **https://howzzat.uk**

### 5. Email forwarding (free)

1. Cloudflare → **howzzat.uk** → **Email** → **Email Routing**
2. Enable routing → verify your personal Gmail
3. Add rule: `hello@howzzat.uk` → forward to your Gmail
4. Optional: `support@`, `noreply@` → same inbox

### 6. Deploy the app to Vercel

1. Push repo to GitHub
2. [vercel.com](https://vercel.com) → Import `howzzat` → root `apps/web`
3. Environment variables (from `apps/web/.env.production.local`):

   | Variable | Example |
   |----------|---------|
   | `NEXT_PUBLIC_APP_URL` | `https://app.howzzat.uk` |
   | `DATABASE_URL` | (production DB — D1 or other) |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | … |
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |
   | `STRIPE_SECRET_KEY` | `sk_live_…` |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
   | Twilio vars | … |

4. Vercel → **Domains** → add `app.howzzat.uk`

### 7. DNS for app subdomain

Cloudflare → **DNS** → **Add record**:

| Type | Name | Target |
|------|------|--------|
| CNAME | `app` | `cname.vercel-dns.com` (Vercel shows exact value) |

### 8. Stripe live webhook

Stripe Dashboard → **Developers → Webhooks**:

- URL: `https://app.howzzat.uk/api/v1/billing/stripe/webhook`
- Event: `checkout.session.completed`
- Copy signing secret → `STRIPE_WEBHOOK_SECRET` on Vercel

### 9. Google OAuth (production)

In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials** → your **Web application** OAuth 2.0 client (the one whose ID is in `GOOGLE_CLIENT_ID` on Vercel):

**Authorized JavaScript origins** (add each):

| URL |
|-----|
| `https://app.howzzat.uk` |

**Authorized redirect URIs** (add each — must match exactly, including `/api/v1`):

| URL |
|-----|
| `https://app.howzzat.uk/api/v1/auth/google/callback` |

Local dev (same Web client or a separate one):

| Type | URL |
|------|-----|
| Origin | `http://localhost:3005` |
| Redirect | `http://localhost:3005/api/v1/auth/google/callback` |

**Vercel:** set `NEXT_PUBLIC_APP_URL` to `https://app.howzzat.uk` (no trailing slash). The app uses this in production when building the Google `redirect_uri`.

**Mobile** (separate OAuth clients — no redirect URI): set `GOOGLE_IOS_CLIENT_ID` and/or `GOOGLE_ANDROID_CLIENT_ID` on Vercel. Native apps exchange an ID token via `POST /api/v1/auth/google/token`.

If you see **Error 400: redirect_uri_mismatch**, the URI in the error details must be added verbatim to **Authorized redirect URIs**.

### 10. Twilio Verify SMS (production)

Twilio Console → **Verify → Services** → your service (`TWILIO_VERIFY_SERVICE_SID`):

1. **Friendly Name** → set to `Howzzat` (not the default “Sample” / trial name).
2. The API also sends `customFriendlyName: "Howzzat"` on each verification.

Expected SMS: `Your Howzzat verification code is: 123456`

---

## Verify

- [ ] https://howzzat.uk — landing page
- [ ] https://howzzat.uk/privacy.html — privacy
- [ ] Email to hello@howzzat.uk arrives
- [ ] https://app.howzzat.uk/login — app
- [ ] Stripe business profile website = https://howzzat.uk
