# Task for the Account & Orders microfrontend (Lit + Material Web)

**Owner:** Mais Arman · **Repo:** https://github.com/mais-arman/fashion-elan-account-orders
**Live:** https://fashion-elan-account-orders.vercel.app/

> Paste everything below into Claude Code (or any coding AI) inside your repo.
> It is written to be handed over as-is.

---

## Context

Your element is the most complete of the three. `<elan-account-app>` registers
from `/mfe/elan-account.js`, takes a reflected `route` property, works out that
it is embedded from that property, refuses to touch `history` while embedded,
emits `elan:navigate` and lets it escape the shadow root. All of that is
verified working inside the shell.

Your shell PR is merged too. The shell kept `preventDefault()` on cancelable
`elan:navigate`, `detail.replace`, setting `route` as both property and
attribute, `/reviews` in your owned routes, and `elan:order-history-updated` in
the watched events.

Shell repo: https://github.com/Sara-Qadi/fashion-elan-shell
Live shell: https://sara-qadi.github.io/fashion-elan-shell/

Two things left.

---

## 1. The 17MB stylesheet ← the one worth fixing

`/mfe/elan-account.css` is **17MB** (12.8MB even gzipped). It is almost entirely
one line — `import 'material-symbols'` — because that package ships its webfont
base64-inlined inside the CSS, and `assetsInlineLimit: 0` does not undo an
inline that the source file already contains.

Your registry entry in the shell listed it as `styles`, and the shell would have
downloaded it on every page load. **It does not load it any more.** Instead the
shell declares the one thing that genuinely cannot live inside a shadow root:

```html
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
```

That is about a kilobyte, and your icons render correctly with it, because
`<md-icon>` carries `font-family: 'Material Symbols Outlined'` in its own shadow
styles and only needs the `@font-face` at document level.

**In your repo**, the equivalent fix is to stop bundling the font:

```ts
// src/mfe.ts — drop this line
import 'material-symbols';
```

and instead add the Google Fonts `<link>` to your standalone `index.html`. Your
`dist/mfe/elan-account.css` then drops to a few KB, and the shell can go back to
loading it normally (tell Sara and she will set `styles` in the registry again).

`src/styles/document.css` is the other thing in that file. The shell already
owns document background, margins and font — so nothing is lost by skipping it
while embedded.

---

## 2. Guest checkout orders are dropped

This one is a design decision, not a bug — flagging it so the team picks
deliberately before the demo.

`importCompletedOrder()` calls `orderService.getOrderById()`, which calls
`getAuthenticatedUserId()`, which throws when nobody is signed in:

```
[ELAN Account] Unable to import the completed order.
OrderError: You must be signed in to access orders.
```

So an order placed **before** signing in never reaches order history, and
signing in afterwards does not recover it — the shared snapshot is still sitting
in localStorage unread.

Three options:

- **(a)** Demo signed-in. Sign in first, then shop. Nothing to build; just make
  sure whoever demos knows the order matters.
- **(b)** Import on sign-in. On `USER_LOGGED_IN`, sweep
  `elan:shared-orders:v1` for snapshots not yet in this user's history and
  import them. Roughly ten lines, and it makes the guest→sign-in path work.
- **(c)** Allow guest orders against a placeholder user id.

**(b)** is the recommended one.

---

## The shared order store — now written, please do not change the shape

You read completed orders from `localStorage['elan:shared-orders:v1']`, matching
the `orderId` on `elan:order-completed`. **Nothing was writing that store**, so
every order failed with `ORDER_SNAPSHOT_NOT_FOUND` and history stayed empty.

The Cart app now writes it, immediately before emitting the event, in exactly
the shape `src/models/shared-order.model.ts` defines:

```json
{
  "version": 1,
  "orders": [
    {
      "orderId": "ELN-2026-157258",
      "status": "processing",
      "paymentStatus": "paid",
      "products": [
        { "productId": "…", "name": "…", "imageUrl": "…",
          "unitPrice": 189, "quantity": 1,
          "selectedColor": "Rust", "selectedSize": "M" }
      ],
      "shippingAddress": {
        "recipientName": "…", "phone": "…", "country": "…",
        "city": "…", "street": "…", "building": "…", "postalCode": "…"
      },
      "pricing": { "subtotal": 433, "shipping": 0, "discount": 0,
                   "tax": 21.65, "total": 454.65, "currency": "USD" },
      "placedAt": "2026-08-09T13:40:50.682Z",
      "estimatedDeliveryDate": "2026-08-14T…"
    }
  ]
}
```

Verified against your validators: totals match the event to within a cent, item
count matches the sum of quantities, currency matches, `imageUrl` is never empty
(a placeholder tile is substituted when the Catalog app does not send one), and
the store keeps the 20 most recent orders.

Two notes on why it is split this way:

- **The event stays minimal on purpose.** `elan:order-completed` carries only
  `orderId`, `total`, `itemCount`, `currency`, `placedAt` and `source`. No
  address, no email, no payment field — customer data must not travel on the
  event bus where any script on the page can listen for it. The detail goes to
  same-origin storage and you look it up by id, which is what you already do.
- **There is no payment data in the snapshot at all**, and there never will be.
  The card number and CVV never leave the checkout form's component state.

---

## Definition of done

- [ ] `dist/mfe/elan-account.css` is under ~100KB (font moved to a CDN link)
- [ ] Icons still render in both the standalone app and the shell
- [ ] A decision made on guest orders — (a), (b) or (c) above
- [ ] The standalone app at the root URL still works unchanged
