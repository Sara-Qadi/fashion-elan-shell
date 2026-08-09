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

All three microfrontends load into the shell and the full journey works
end to end: browse a category → open a product → add to bag → cart →
shipping → payment → review → place order.

| Part | Element bundle | In the shell |
|---|---|---|
| Cart & Checkout | ✅ `/elan-cart-app.js` | Working |
| Account & Orders | ✅ `/mfe/elan-account.js` | Working |
| Catalog & Discovery | ⚠️ built, but Vercel publishes `dist/` while the element goes to `dist-element/` | Working, loaded from jsDelivr off the committed build |

Remaining work sits in the two member repos, not here. Both briefs are written
to be handed straight to a coding AI:

- [`docs/PROMPT-catalog-react.md`](docs/PROMPT-catalog-react.md) — publish the
  element from `dist/`, accept an `embedded` prop, drop two `alert()` calls
- [`docs/PROMPT-account-lit.md`](docs/PROMPT-account-lit.md) — move the icon font
  out of a 17MB stylesheet, and decide what happens to guest orders

The shell degrades honestly: a microfrontend that cannot be loaded shows what
was requested and what failed, and the other two keep working.

## The shared chrome

The shell renders **one** header, category nav and footer for all three apps —
the Catalog storefront design, since that was the strongest of the three. Each
microfrontend suppresses its own while embedded, so the composed page has one of
each rather than three.

- Cart is told `embedded` and drops its header and footer itself.
- Catalog's are hidden by the shell's CSS until it accepts the same flag.
- Account renders no site chrome of its own; its sidebar is page-level nav.

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
   `composed: true`. The one exception is the completed-order snapshot, which
   goes through same-origin `localStorage` precisely *because* customer data
   must not travel on the bus.
3. **Elements are hidden, never destroyed.** Cart has to hear
   `elan:add-to-cart` while the shopper is on a Catalog page, and Account has to
   hear `elan:order-completed` on the Cart's confirmation route. An unmounted
   app hears nothing, so every app stays on the page once loaded.

## Source map

| File | Responsibility |
|---|---|
| `src/registry.js` | The three microfrontends: URL, tag, owned routes. The whole contract in one table |
| `src/loader.js` | Fetches a bundle from its live URL; stable filename first, index.html discovery as fallback |
| `src/router.js` | Owns `history`, decides which element is *visible*; mounted elements are never destroyed |
| `src/bus.js` | Listens to every `elan:*` event, translates the names the three contracts disagreed on |
| `src/chrome.js` | Shared header, category nav, search, footer, bag badge, event inspector |
| `src/styles.js` | Declares icon `@font-face`s a shadow root cannot provide for itself |
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
- **Catalog is served from jsDelivr**, which reflects the last *commit* rather
  than the last deploy and caches for hours. Temporary — see the brief.
- **Guest orders never reach order history.** Account requires a signed-in user
  before it will file one. Sign in before checking out when demoing.
- **Light-DOM apps share one stylesheet namespace.** The shell's CSS is scoped
  to `.elan-*`, but Vuetify's reset ships inside the Cart bundle and lands on
  the document — `html { overflow-x: hidden }` from it silently broke
  `position: sticky` on the header until the shell took `body` overflow back.
- **The discovery fallback is fragile by design.** It parses `index.html` to
  find a hashed entry. It exists so integration works before everyone has added
  a stable filename — not as the long-term contract.
