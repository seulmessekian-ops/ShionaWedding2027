# Vercel setup (for whoever hosts the site)

The map needs a Mapbox token injected at deploy time. **You** (the Vercel project owner) must add it — the site author cannot do this from their account.

## Steps (about 2 minutes)

1. Open your Vercel project linked to [ShionaWedding2027](https://github.com/seulmessekian-ops/ShionaWedding2027).
2. Go to **Settings → Environment Variables**.
3. Add a new variable:
   - **Key:** `MAPBOX_TOKEN`
   - **Value:** *(ask the site author for the `pk.…` token — do not commit it to GitHub)*
   - **Environments:** enable **Production** and **Preview**
4. Go to **Deployments** → latest deployment → **⋯ → Redeploy**.

## Verify

Open `https://<your-vercel-domain>/assets/config.js` in a browser.

- **Good:** `window.MAPBOX_CONFIG = { token: "pk.eyJ..." };`
- **Bad:** `token: ""` — env var missing or redeploy needed.

Then scroll to the journey map on the homepage — it should load Armenia with the route line.

## Mapbox URL restrictions

Whoever owns the [Mapbox account](https://account.mapbox.com/access-tokens/) must allow your Vercel URL on the token, e.g.:

- `https://shiona-2027.vercel.app/*`
- `https://*.vercel.app/*`
- `http://localhost:*`

Without this, the map may show an authorization error even when the token is set.
