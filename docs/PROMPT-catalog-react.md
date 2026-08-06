# Task for the Catalog & Discovery microfrontend (React + MUI)

**Owner:** Maha Hussam · **Repo:** https://github.com/Maha-hussam/fashion_elan_category_discovery
**Live:** https://fashion-elan-category-discovery.vercel.app/

> Paste everything below into Claude Code (or any coding AI) inside your repo.
> It is written to be handed over as-is.

---

## Context

Our group integrates three separately-deployed microfrontends into one shell app
using **Web Components**. The shell loads each app's JavaScript bundle from its
**live deployment URL** and mounts it as a custom element.

- Shell repo: https://github.com/Sara-Qadi/fashion-elan-shell
- The Account app (Lit) already works this way: `<elan-account-app>`
- The Cart app (Vue) already works this way: `<elan-cart-app>`

Your app is currently a normal React SPA that mounts into `<div id="root">`.
It needs a second build output that registers a custom element instead. **Do not
change or break the standalone app** — it must keep working exactly as it does
now at its own URL.

**What happens today:** the shell already fetches your live bundle successfully.
It then fails with `Minified React error #299` — *"target container is not a DOM
element"* — because your entry runs `createRoot(document.getElementById('root'))`
and there is no `#root` in the shell's page. Loading the bundle is not the
problem; it is that nothing registers a custom element. That is the whole task.

## What to build

Add a second build target that produces **one self-contained file** at a
**stable, unhashed path**:

```
https://fashion-elan-category-discovery.vercel.app/elan-catalog-app.js
```

The filename must never change. The shell hardcodes it, so a content hash
(`index-a1b2c3.js`) breaks integration on every deploy.

Loading that file must register `<elan-catalog-app>` as a side effect, so this
is all the shell has to do:

```html
<script type="module" src="https://.../elan-catalog-app.js"></script>
<elan-catalog-app route="/"></elan-catalog-app>
```

## The element contract

### 1. The shell owns the URL — your app must not touch it

Three routers on one page all listening to `popstate` will fight. Inside the
custom element:

- Do **not** use `BrowserRouter`. Use `MemoryRouter` (or your own state).
- Read the current path from a **`route` property/attribute** the shell sets.
- React to it changing — the shell writes it on every navigation.
- When the user navigates *inside* your app, do not call `history.pushState`.
  Emit an event instead (below) and let the shell update the address bar.

Your app keeps `BrowserRouter` in the standalone build. Only the element build
switches to memory routing.

### 2. Events

Emit on `window`, always with `bubbles: true` and `composed: true`, and always
include `source: 'elan-catalog'` in `detail`.

**Emit these:**

| Event | `detail` |
|---|---|
| `elan:add-to-cart` | `{ source, productId, name, price, currency, imageUrl, quantity, selectedColor?, selectedSize? }` |
| `elan:navigate` | `{ source, path }` — whenever you navigate internally |
| `elan:product-selected` | `{ source, productId }` |
| `elan:category-selected` | `{ source, category }` |
| `elan:search-updated` | `{ source, query, resultCount }` |
| `elan:wishlist-item-added` | `{ source, item }` |

**Listen for these:**

| Event | What to do |
|---|---|
| `elan:cart-updated` | `detail.itemCount` — update any cart badge you show |
| `elan:user-logged-in` / `elan:user-logged-out` | `detail.user` / `detail.userId` |
| `elan:wishlist-updated` | `detail.items` |

### 3. ⚠️ One event name must change

Your contract says you listen for **`elan:checkout-completed`**. The Cart app
emits **`elan:order-completed`**, and the Account app also expects
`elan:order-completed`. Two apps against one, so the agreed name is:

```
elan:order-completed
```

Payload: `{ source, orderId, total, itemCount, currency, placedAt }`

It deliberately contains **no** customer address, email or payment data — the
Cart app will not emit those. Please switch your listener to
`elan:order-completed`. (The shell currently re-emits your old name as a
temporary bridge, but that alias will be deleted before submission.)

### 4. Routes you own

The shell routes these paths to you and passes the full path in `route`:

```
/            /catalog     /catalog/*
/product/*   /search      /category/*
```

If `route` is a path you do not recognise, render your home page rather than
throwing.

## Build configuration hints (Vite + React)

1. `npm i @r2wc/react-to-web-component`
2. New entry `src/element.jsx`:
   - wrap your root component with `r2wc(App, { props: { route: 'string' } })`
   - `customElements.define('elan-catalog-app', ...)` guarded by
     `if (!customElements.get(...))`
3. New `vite.element.config.js` using `build.lib` with:
   - `fileName: () => 'elan-catalog-app.js'`, `formats: ['es']`
   - `rollupOptions.output.inlineDynamicImports: true` — the shell loads this
     cross-origin and cannot resolve your relative chunk URLs
   - `cssCodeSplit: false`
   - **`define: { 'process.env.NODE_ENV': '"production"' }`** — library mode
     skips the replacement React relies on, and without this the bundle throws
     `process is not defined` in the browser
4. Fold the emitted CSS into the JS (a ~15-line post-build script that reads the
   `.css` file and prepends a `<style>` injector), so the shell has exactly one
   URL to load. Guard the injection with an element `id` so two instances do not
   duplicate it.
5. Watch the bundle size. **Vite base64-inlines every asset in library mode.**
   If you bundle an icon font or large images this way the file explodes — ours
   went to 7MB before we loaded the font from a CDN instead.
6. Add the element build to your normal `npm run build` and copy the output into
   `dist/` so Vercel publishes it with the app.

## Definition of done

- [ ] `https://fashion-elan-category-discovery.vercel.app/elan-catalog-app.js` returns **200** with content-type `application/javascript`
- [ ] Loading it in a blank page registers `<elan-catalog-app>`
- [ ] `<elan-catalog-app route="/product/123"></elan-catalog-app>` renders that product
- [ ] Changing the `route` property re-renders without a reload
- [ ] Internal navigation emits `elan:navigate` with `{ path }`
- [ ] Add-to-cart emits `elan:add-to-cart` with the payload above
- [ ] You listen for `elan:order-completed` (not `elan:checkout-completed`)
- [ ] The standalone app at the root URL still works unchanged
- [ ] Nothing in the element calls `history.pushState` or reads `location`
