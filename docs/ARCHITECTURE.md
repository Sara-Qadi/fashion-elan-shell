# ELAN — Architecture

One page, three independently deployed applications, three different frameworks.

## The diagram

```
                     ┌─────────────────────────────────────────────┐
                     │  SHELL  (vanilla JS + Vite)                 │
                     │  https://sara-qadi.github.io/               │
                     │                    fashion-elan-shell/      │
                     │                                             │
                     │  owns: the URL · the header · the event bus │
                     │  owns no product, cart or account data      │
                     └───────────────┬─────────────────────────────┘
                                     │
              route property ────────┼──────── elan:* CustomEvents
                     (shell → app)   │        (app → shell → apps)
                                     │
       ┌─────────────────────────────┼─────────────────────────────┐
       │                             │                             │
┌──────▼───────────┐      ┌──────────▼────────┐      ┌─────────────▼────┐
│ <elan-catalog-   │      │ <elan-cart-app>   │      │ <elan-account-   │
│         app>     │      │                   │      │          app>    │
│                  │      │                   │      │                  │
│ React + MUI      │      │ Vue 3 + Vuetify   │      │ Lit + Material   │
│ Maha Hussam      │      │ Sara Qadi         │      │ Mais Arman       │
│                  │      │                   │      │                  │
│ Vercel           │      │ GitHub Pages      │      │ Vercel           │
└──────────────────┘      └───────────────────┘      └──────────────────┘
   /  /catalog             /cart                       /account
   /product/*              /checkout/*                 /login /register
   /search /category/*     /order-confirmation         /orders /wishlist

Each element's JS bundle is fetched at runtime from that member's own live
deployment. The shell contains no copy of anyone's code.
```

## Why Web Components

The assignment's own comparison table calls it *"Best fit here — React/Vue can
each compile to a custom element and Lit already is one."* It was also the only
method that let three different frameworks coexist without any of them having to
know the others exist. A custom element is a DOM node; React does not care that
the node next to it is Vue.

## The two rules that make it work

### 1. The shell owns the URL

Three history routers on one page all listen to `popstate` and all write to
`location`. They will fight, and the loser silently renders the wrong screen.

So each microfrontend runs an **in-memory router** while embedded:

```
shell  ──  sets the `route` property  ──▶  element renders that path
shell  ◀──  elan:navigate { path }    ──   element navigated internally
```

The shell turns `elan:navigate` into a real `history.pushState`. Each app keeps
its normal browser router in its standalone build — only the element build
switches.

### 2. Events are the only shared state

There is no shared store, no backend, no cross-app imports. Everything travels
as `CustomEvent` on `window` with `bubbles: true` and `composed: true`.
`composed` matters because Account renders in a shadow root, and events would
otherwise never escape it.

## Light DOM vs shadow DOM

| App | Mode | Why |
|---|---|---|
| Account (Lit) | Shadow DOM | Lit's default; Material Web is built for it |
| Cart (Vue) | **Light DOM** | Vuetify teleports dialogs, menus and snackbars to `document.body` and ships a global stylesheet. In a shadow root those overlays render outside the styles that make them legible |
| Catalog (React) | Either | MUI works both ways; light DOM is simpler |

Mixing is fine. The trade-off is that light-DOM apps share one global stylesheet
namespace, which is why the shell's own CSS is scoped hard to `.elan-*` class
names and avoids bare element selectors.

## Event map

```
Catalog ──── elan:add-to-cart ─────────────▶ Cart
Catalog ──── elan:product-selected ────────▶ (shell logs)
Cart ─────── elan:cart-updated ────────────▶ Catalog, shell badge
Cart ─────── elan:checkout-started ────────▶ (shell logs)
Cart ─────── elan:order-completed ─────────▶ Account, Catalog
Account ──── elan:user-logged-in/out ──────▶ Catalog
Account ──── elan:add-to-cart ─────────────▶ Cart          (from wishlist)
Account ──── elan:wishlist-updated ────────▶ Catalog
any ──────── elan:navigate { path } ───────▶ Shell (owns history)
```

## What the shell does NOT do

- No product, cart, session or order data of its own
- No framework — bringing React/Vue/Lit in would privilege one member
- No copies of anyone's code; every bundle is fetched from its live URL
- No backend. The whole project is mock data in `localStorage`

## Storage ownership

Each app owns its keys and never writes another's.

| App | Keys |
|---|---|
| Catalog | `elan:products`, `elan:categories`, `elan:search-history`, `elan:recent-products`, `elan:catalog-filters` |
| Cart | `elan.checkout.cart.v1`, `elan.checkout.checkout.v1`, `elan.checkout.last-order.v1` |
| Account | `elan:mock-auth:users`, `elan:mock-auth:session`, `elan:profile:<userId>`, `elan_wishlist`, `elan:reviews:<userId>`, `elan:orders:<userId>` |
