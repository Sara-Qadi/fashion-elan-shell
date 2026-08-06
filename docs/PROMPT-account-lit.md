# Task for the Account & Orders microfrontend (Lit + Material Web)

**Owner:** Mais Arman · **Repo:** https://github.com/mais-arman/fashion-elan-account-orders
**Live:** https://fashion-elan-account-orders.vercel.app/

> Paste everything below into Claude Code (or any coding AI) inside your repo.
> It is written to be handed over as-is.

---

## Context

Our group integrates three separately-deployed microfrontends into one shell app
using **Web Components**. The shell loads each app's bundle from its **live
deployment URL** and mounts it as a custom element.

- Shell repo: https://github.com/Sara-Qadi/fashion-elan-shell
- Cart app (Vue): `<elan-cart-app>` — done
- Catalog app (React): `<elan-catalog-app>` — in progress

**Your app is already the furthest along.** `<elan-account-app>` is registered
and is the root of your page, with an open shadow root, and it already exposes
`handleLocationChange`, `handleNavigationRequest`, `handleUserLoggedIn` and
`handleUserLoggedOut`. Two things are still missing.

## What to change

### 1. Publish a stable, unhashed bundle URL  ← the blocking one

Right now your only entry is `/assets/index-gGpSDwtQ.js`. That hash changes on
every deploy, so the shell cannot hardcode it. Add a second build target that
emits **one self-contained file** at:

```
https://fashion-elan-account-orders.vercel.app/elan-account-app.js
```

Loading it must register `<elan-account-app>` as a side effect. Nothing else.

Vite hints:

- separate `vite.element.config.js` using `build.lib`
- `fileName: () => 'elan-account-app.js'`, `formats: ['es']`
- `rollupOptions.output.inlineDynamicImports: true` — the shell loads this
  cross-origin and cannot resolve your relative chunk URLs
- `define: { 'process.env.NODE_ENV': '"production"' }` — library mode skips the
  replacement, and the bundle otherwise throws `process is not defined`
- watch the size: **Vite base64-inlines every asset in library mode**, so a
  bundled icon font can balloon the file (ours hit 7MB before we moved the font
  to a CDN)
- add it to `npm run build` and copy into `dist/` so Vercel publishes it

*(Until this exists, the shell falls back to reading your `index.html` and
pulling the hashed script out of it. That works today, but it re-downloads your
HTML on every load and breaks the moment Vercel changes anything — please do not
rely on it.)*

### 2. Accept a `route` property from the shell

**Observed when running your live element inside the shell:** the shell mounted
you at `/account`, and your route guard immediately rewrote the address bar to
`/login` by writing history directly. Your `currentRoute` stayed `/login` even
after the shell pushed `/orders`.

It happens to survive today only because the shell also routes `/login` to you.
The moment a guard redirect lands on a path the shell gives to Catalog or Cart,
the shell and your element will disagree about what is on screen.

`observedAttributes` is currently `[]`, so there is no way for the shell to tell
you where you are. That is the change:

The shell owns the URL; your element must not read `location` or call
`history.pushState` while embedded. You already have `handleLocationChange`, so
this should be small:

- expose a **`route` property/attribute** (a path string like `/account/orders`)
- render according to it, and re-render when it changes
- when the user navigates inside your app, emit `elan:navigate` with
  `{ source: 'elan-account', path }` instead of pushing history

Routes the shell sends you:

```
/account   /account/*   /login   /register   /orders   /wishlist   /profile
```

Unrecognised path → render your dashboard rather than throwing.

## Event contract (mostly already correct)

Keep `bubbles: true` and `composed: true` — **composed matters for you** more
than anyone, because your element has a shadow root and events would otherwise
not escape it.

Your existing events are unchanged: `elan:user-logged-in`,
`elan:user-registered`, `elan:user-logged-out`, `elan:profile-updated`,
`elan:wishlist-item-removed`, `elan:wishlist-updated`, `elan:add-to-cart`,
`elan:review-submitted`, `elan:navigate`.

### ⚠️ One expectation needs adjusting

Your contract says you expect `elan:order-completed` with `{ order }`.

The Cart app emits it **flat and deliberately minimal**:

```js
{ source: 'elan-cart-checkout', orderId, total, itemCount, currency, placedAt }
```

There is **no** shipping address, no email, no payment field, and this will not
change — the card number and CVV never leave the checkout form at all, and the
order event was designed so no customer data can leak through it.

So order history cannot be built from the event payload alone. Pick one:

- **(a)** store what you need at add-to-cart / checkout-started time and use
  `orderId` from the event to close the record — *recommended, no coordination*
- **(b)** read the Cart app's `localStorage` key `elan.checkout.last-order.v1`,
  which holds the full order snapshot. Same browser only, and it couples you to
  someone else's storage key
- **(c)** ask the Cart app to expose a `getOrder(orderId)` method on its element

## Definition of done

- [ ] `https://fashion-elan-account-orders.vercel.app/elan-account-app.js` returns **200** with content-type `application/javascript`
- [ ] Loading it in a blank page registers `<elan-account-app>`
- [ ] `<elan-account-app route="/orders"></elan-account-app>` renders order history
- [ ] Changing the `route` property re-renders without a reload
- [ ] Internal navigation emits `elan:navigate` with `{ path }`
- [ ] Order history works from `orderId` alone (option a, b or c above)
- [ ] The standalone app at the root URL still works unchanged
- [ ] Nothing in the element calls `history.pushState` or reads `location`
