# Shant &amp; Siona — Wedding Website

A bilingual (English / Armenian) wedding site with an editorial heritage-luxury
aesthetic: botanical (peony) line-art framing, a lace medallion, and a
**scroll-driven Mapbox map of Armenia** that travels from venue to venue along
a real driving route. Built as plain HTML, CSS and vanilla JavaScript — **no
build step** — so it loads fast and can be hosted anywhere. Mapbox GL JS and
Turf load from CDN; the route geometry is baked into `assets/route.geojson`.

Palette: **burgundy · olive green · cream · gold**.

```
armenian-wedding/
├── index.html            ← all page content + Mapbox map container
├── vercel.json           ← Vercel build (writes config.js from MAPBOX_TOKEN)
├── assets/
│   ├── styles.css        ← all styling (design tokens at the very top)
│   ├── script.js         ← language toggle, countdown, journey map, RSVP, menu
│   ├── config.js         ← Mapbox token (gitignored; generated at build)
│   └── route.geojson     ← baked driving route (Yerevan → Goris → Tatev → Sisian)
├── scripts/
│   └── sync-mapbox-config.sh
└── README.md             ← this file
```

---

## 1. Content to review / change

All text lives in **`index.html`**. The real details are already in place:

| What | Value used | Where |
|------|-----------|-------|
| Couple | **Shant &amp; Siona** (hero), full legal names below it | hero, footer, `<title>` |
| Wedding day | **7 July 2027** | hero, countdown (see §2), events, footer |
| Welcome party | **4 July** · Megerian Carpet, Yerevan · with Vardavar | Celebration + map stop 1 |
| Ritual | **6 July** · a street in Goris | Celebration + map stop 2 |
| Ceremony | **7 July** · Tatev Monastery | Celebration + map stop 3 |
| Reception | **7 July** · MJA Resort, near Sisian | Celebration + map stop 4 |
| RSVP deadline | 1 March 2027 (placeholder) | RSVP section |

> Every translatable element carries both `data-en="…"` and `data-hy="…"`.
> When you edit English text, edit the matching `data-hy` (Armenian) too.

**Placeholders you may want to set:** event times are illustrative; the "Our
Story" paragraph is a warm placeholder you can replace with your real story; the
RSVP form needs wiring (see §5).

---

## 2. The countdown

In **`assets/script.js`**, near the top:

```js
var TARGET = new Date('2027-07-07T13:00:00+04:00').getTime();
```

`+04:00` is Armenia time (no daylight saving). Change the date/time as needed.

---

## 3. The journey map (scroll-driven Mapbox map)

The **#journey** section uses [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
to show a real terrain map of Armenia. As the guest scrolls through the pinned
section, the camera moves between the four wedding venues and a gold route line
draws on along the actual driving path south through Syunik.

### Mapbox access token (required)

1. Create a free account at [mapbox.com](https://account.mapbox.com/).
2. Copy your **public** access token.
3. Set up local config (not committed to git):

   ```bash
   cp .env.example .env
   cp assets/config.example.js assets/config.js
   ```

   Paste your token into `.env` as `MAPBOX_TOKEN=pk.…` and into `assets/config.js`:

   ```js
   window.MAPBOX_CONFIG = { token: 'pk.your_token_here' };
   ```

   Alternatively, set `<meta name="mapbox-token" content="pk.…">` in `index.html`.

The token is visible in the browser (normal for Mapbox). Restrict it to your
domain in the Mapbox dashboard before going live.

Without a token, the map shows a short fallback message; journey cards still work.

### Vercel deploy

1. Import the repo in [Vercel](https://vercel.com/new) (or connect `ShionaWedding2027` from GitHub).
2. **Project → Settings → Environment Variables** — add **`MAPBOX_TOKEN`** with your public `pk.…` token (Production, Preview, and Development).
3. Deploy. Vercel runs `scripts/sync-mapbox-config.sh` at build time to write `assets/config.js` from that variable.

Local sync (optional): `./scripts/sync-mapbox-config.sh` reads `.env` → `assets/config.js`.

Restrict your Mapbox token to your Vercel URL(s), e.g. `https://*.vercel.app/*` and your custom domain, plus `http://localhost:*` for local dev.

### Stops (single source of truth)

Edit the `JOURNEY_STOPS` array near the top of `assets/script.js`:

```js
var JOURNEY_STOPS = [
  { id: 'yerevan', lng: 44.4939, lat: 40.1553, zoom: 12, labelEn: 'Yerevan', labelHy: 'Երևան' },
  { id: 'goris',   lng: 46.3380, lat: 39.5110, zoom: 13, labelEn: 'Goris',   labelHy: 'Գորիս' },
  { id: 'tatev',   lng: 46.2503, lat: 39.3793, zoom: 14, labelEn: 'Tatev',   labelHy: 'Տաթև' },
  { id: 'sisian',  lng: 46.0350, lat: 39.5210, zoom: 13, labelEn: 'Sisian',  labelHy: 'Սիսիան' }
];
```

`lng` / `lat` are WGS-84 coordinates; `zoom` controls how close the map gets at
each stop. Journey card copy stays in `index.html` (`#journeyCards`).

### Route line (`assets/route.geojson`)

The route is **pre-baked** so guests never hit the Directions API at runtime.
It follows the chronological wedding order:

**Megerian Carpet (Yerevan) → Goris → Tatev Monastery → MJA Resort (Sisian)**

To regenerate after changing stop coordinates:

```bash
# Option A — OSRM (free, no key)
curl -s "https://router.project-osrm.org/route/v1/driving/LNG1,LAT1;LNG2,LAT2;LNG3,LAT3;LNG4,LAT4?overview=full&geometries=geojson" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
coords = data['routes'][0]['geometry']['coordinates']
# simplify if needed (keep ~400 points)
step = max(1, len(coords) // 400)
coords = [coords[0]] + coords[step:-1:step] + [coords[-1]]
fc = {'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':'Wedding journey route'},'geometry':{'type':'LineString','coordinates':coords}}]}
json.dump(fc, open('assets/route.geojson','w'), separators=(',',':'))
print('Done —', len(coords), 'points')
"

# Option B — Mapbox Directions API (needs token)
# https://api.mapbox.com/directions/v5/mapbox/driving/{coords}?geometries=geojson&access_token=TOKEN
```

### Map behaviour

- **Interactive scroll:** sticky stage, camera `jumpTo` between stops, route
  reveals via `line-gradient` + `line-progress`, traveling dot on the path.
- **Step dots / markers:** click to jump to that stop.
- **Reduced motion:** full route visible, map fits all four stops, cards stack below.
- **Lazy init:** map loads when `#journey` enters the viewport.

Map style defaults to `mapbox://styles/mapbox/outdoors-v12`. Swap for a custom
[Mapbox Studio](https://studio.mapbox.com/) style to match the site palette.

---

## 4. Colours, fonts &amp; spacing

`assets/styles.css` → the `:root { … }` block holds every design token:

```css
--wine:  #5b1320;   /* burgundy (primary)  */
--olive: #56602f;   /* olive green (accent) */
--gold:  #c2a14d;   /* gold                 */
--cream: #f5ecda;   /* page background      */
```

Fonts load from Google Fonts in `<head>`: **Cinzel** (headings),
**Cormorant Garamond** (body), **Pinyon Script** (script flourishes),
**Noto Serif Armenian** (Armenian text).

---

## 5. Wiring up the RSVP form

The form validates and shows a thank-you message but does **not** send anywhere
yet (see the `--- DEMO submission ---` comment in `script.js`). To collect real
replies: create a [Formspree](https://formspree.io) form and add
`action="https://formspree.io/f/yourID" method="POST"` to `<form id="rsvpForm">`,
then replace the demo `setTimeout` block with a `fetch(form.action, …)`. Google
Forms and Netlify Forms work too.

---

## 6. Editing the FAQ

Each question is a native `<details>` block in the FAQ section — add, remove or
reorder them freely; the accordion behaviour and styling are automatic.

---

## 7. Previewing &amp; deploying

**Local preview** (from inside `armenian-wedding/`):

```bash
./scripts/sync-mapbox-config.sh   # needs .env with MAPBOX_TOKEN
python3 -m http.server 5050       # → http://localhost:5050
```

**Vercel** (recommended): connect the GitHub repo, set the `MAPBOX_TOKEN` environment variable, and deploy. See §3 “Vercel deploy” for details. Any static host works too — upload the folder with `assets/config.js` generated at build time (never commit the token).

---

## 8. Accessibility &amp; performance (built in — please keep)

- Respects `prefers-reduced-motion` (scroll-camera and route animation switch
  off automatically; static map shows the full route).
- All animation uses `transform`/`opacity` only; the map camera updates inside a
  `requestAnimationFrame` loop — smooth on low-end phones.
- Labelled form fields, visible keyboard focus, a skip link, native accordions,
  44px-minimum touch targets, `display=swap` fonts.
- Works from ~320px wide up to large desktops.

---

## ⚠️ Please have a native Armenian speaker proofread

The Armenian copy was written carefully but should be reviewed before sending —
especially the **transliterated surnames** (Eulmessekian → «Էուլմեսսեքյան»,
Amrgousian → «Ամրգուսյան» are best-effort) and the more poetic lines. All
Armenian strings live in the `data-hy="…"` attributes in `index.html`.
