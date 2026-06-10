# Find a Church — going live (dev handoff)

The whole search UI talks to **one module**: `church-api.js` (`window.ChurchAPI`).
Swap from sample data to live Google data by setting two values — no UI changes.

```js
// once, before the flow runs (e.g. top of search-flow or a config script)
ChurchAPI.config({
  googleKey:   'YOUR_GOOGLE_MAPS_PLATFORM_KEY',   // empty string = mock mode
  backendBase: 'https://api.declareandbelieve.com', // your enrichment service (phase 2)
  radiusMiles: 35
});
```

`ChurchAPI.mode()` returns `'live'` as soon as a `googleKey` is present.

---

## Phase 1 — live discovery (Google, no backend required)

Uses **Places API (New)**, called straight from the browser (it supports CORS with a key).

1. In Google Cloud, enable **Places API (New)** and **Geocoding API**.
2. Create an API key, **restrict it by HTTP referrer** to your domains.
3. Drop the key into `ChurchAPI.config({ googleKey })`.

What it powers automatically:
- **Nearby** → `places:searchNearby` with `includedTypes:['church']`.
- **City / zip** ("Where") → `Geocoding` turns text into coordinates, then search.
- Each result maps to a church card: name, address, **coordinates**, website, phone, and (best-effort) opening hours.

> Browser geolocation for true "Nearby": wire `navigator.geolocation.getCurrentPosition`
> into `ChurchAPI.config` or pass the coords into `search()`. Left as a TODO so the
> demo stays deterministic.

## Phase 2 — enrichment (your backend) for **service times + Online**

Google knows the *building*, not what happens inside. Two fields Declare needs come from enrichment:
- **`online`** — does this church livestream? (drives the Online filter + badge)
- **`serviceTimes`** — real worship times (Google's hours ≈ office hours, not services)

`church-api.js` calls **one endpoint** and merges the result in:

```
GET {backendBase}/enrich?placeIds=ID1,ID2,ID3
→ {
    "ID1": {
      "online": true,
      "serviceTimes": [{ "day":"Sunday", "items":[["9:00 AM","Worship"],["11:00 AM","Worship"]] }],
      "lang": "English",            // optional extras, all optional:
      "style": "Contemporary",
      "pastor": "…", "desc": "…", "tag": "Welcoming", "members": 850, "email": "…"
    }
  }
```

How you fill that DB (any mix):
- A lightweight admin where your team sets `online` + service times per church.
- A one-time scrape of the church's website (link comes from Places `websiteUri`).
- Churches connecting Planning Center / Church Center later.

If `backendBase` is empty, the app still runs (discovery only); Online/service-times
just stay blank until enrichment exists.

## Out of scope — Events (phase 3)
Intentionally **not** built. There's no reliable church-events feed and we don't
control that data, so it was removed from the product.

---

## Where things live
| File | Role |
|---|---|
| `church-api.js` | the data seam — mock + Google providers, mapping, enrichment merge |
| `church-shared.js` | sample data (`DECLARE_CHURCHES`), helpers, detail HTML |
| `search-flow.js` | all UI/flow logic — provider-agnostic, only calls `ChurchAPI` |
| `search.css` / `church-shared.css` | styles |
| `Find-a-Church-Flow.html` | the screen shell |

To verify live wiring without touching code, open the page and run in console:
```js
ChurchAPI.config({ googleKey:'…' });
ChurchAPI.search({ lat:28.54, lng:-81.38 }).then(console.log);
```
