# ELAN — Shell Application

Integration-only shell for the Fashion & Apparel marketplace (Group 1). It loads
three independently deployed microfrontends, written in three different
frameworks, into one experience using **Web Components**.

**Live shell:** https://sara-qadi.github.io/fashion-elan-shell/

## The three microfrontends

| Part | Owner | Framework | Element | Live | Repo |
|---|---|---|---|---|---|
| Catalog & Discovery | Maha Hussam | React + MUI | `<elan-catalog-app>` | [live](https://fashion-elan-category-discovery.vercel.app/) | [repo](https://github.com/Maha-hussam/fashion_elan_category_discovery) |
| Cart & Checkout | Sara Qadi | Vue 3 + Vuetify | `<elan-cart-app>` | [live](https://sara-qadi.github.io/fashion-elan-card-checkout/) | [repo](https://github.com/Sara-Qadi/fashion-elan-card-checkout) |
| Account & Orders | Mais Arman | Lit + Material Web | `<elan-account-app>` | [live](https://fashion-elan-account-orders.vercel.app/) | [repo](https://github.com/mais-arman/fashion-elan-account-orders) |

The shell contains **no copy** of any of them. Each bundle is fetched at runtime
from that member's own deployment, which is what the assignment requires.

## Integration status

| Part | Publishes a custom element? | In the shell |
|---|---|---|
| Cart & Checkout | ✅ `/elan-cart-app.js` | Working |
| Account & Orders | ⚠️ element exists, but only behind a hashed filename | Loads via the discovery fallback |
| Catalog & Discovery | ❌ still a plain React SPA | Shows a "not published yet" panel |

Instructions for the two remaining pieces are in
[`docs/PROMPT-catalog-react.md`](docs/PROMPT-catalog-react.md) and
[`docs/PROMPT-account-lit.md`](docs/PROMPT-account-lit.md) — written so they can
be handed straight to a coding AI.

The shell degrades honestly: a microfrontend that cannot be loaded shows what
was requested and what failed, and the other two keep working.

## Run it

```bash
npm install
npm run dev      # http://localhost:5180
```

Dev still loads the **live** bundles, so you can develop the shell without
running anyone else's project locally.

```bash
npm run build    # dist/ + 404.html for the SPA fallback
npm run preview
```

## How it works

Two rules, explained in full in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md):

1. **The shell owns the URL.** Each app runs an in-memory router while embedded
   and is told where it is via a `route` property. When it navigates internally
   it emits `elan:navigate`, and the shell writes the address bar. Three history
   routers in one page would fight over `popstate`.
2. **Events are the only shared state.** No shared store, no backend, no
   cross-app imports — just `CustomEvent`s on `window` with `bubbles: true` and
   `composed: true`.

## Source map

| File | Responsibility |
|---|---|
| `src/registry.js` | The three microfrontends: URL, tag, owned routes. The whole contract in one table |
| `src/loader.js` | Fetches a bundle from its live URL; stable filename first, index.html discovery as fallback |
| `src/router.js` | Owns `history`, decides which element is mounted, keeps it alive across route changes within one app |
| `src/bus.js` | Listens to every `elan:*` event, translates the names the three contracts disagreed on |
| `src/chrome.js` | Shared header, bag badge, and the event inspector |
| `src/basePath.js` | Translates between browser paths (`/fashion-elan-shell/cart`) and app paths (`/cart`) |

## Event inspector

The floating **Events** button opens a live log of everything crossing the bus.
It is the fastest way to show, in a demo, that three separate applications are
actually talking to each other.

## Deployment

GitHub Actions publishes to GitHub Pages on every push to `main`
(`.github/workflows/deploy.yml`). Because Pages serves from `/<repo>/` and has
no rewrite rules, two things adapt:

- `vite.config.js` sets `base` to `/fashion-elan-shell/` in production, and
  `src/basePath.js` keeps the router working under that prefix
- `scripts/spa-fallback.mjs` copies `index.html` to `404.html`, so a hard
  refresh on `/cart` still reaches the shell router

For a root deploy (Vercel/Netlify), build with `VITE_BASE=/`.

## Known issues

- **Deep-link refresh returns HTTP 404** while rendering correctly. That is
  inherent to the GitHub Pages fallback; a host with real rewrites returns 200.
- **Light-DOM apps share one stylesheet namespace.** The shell's CSS is scoped
  to `.elan-*` and avoids bare element selectors, but two light-DOM
  microfrontends can still affect each other.
- **The discovery fallback is fragile by design.** It parses `index.html` to
  find a hashed entry. It exists so integration works before everyone has added
  a stable filename — not as the long-term contract.
