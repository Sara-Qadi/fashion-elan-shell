# Task for the Catalog & Discovery microfrontend (React + MUI)

**Owner:** Maha Hussam · **Repo:** https://github.com/Maha-hussam/fashion_elan_category_discovery
**Live:** https://fashion-elan-category-discovery.vercel.app/

> Paste everything below into Claude Code (or any coding AI) inside your repo.
> It is written to be handed over as-is.

---

## Context

Your element build already works. `src/element.tsx`, `vite.element.config.ts` and
`ElementApp.tsx` are all correct — `<elan-catalog-app>` registers, takes a
`route` prop, uses `MemoryRouter`, and emits `elan:navigate`. The shell loads it
and the storefront renders inside the composed page today.

There are three things left, and the first is the only one that matters.

Shell repo: https://github.com/Sara-Qadi/fashion-elan-shell
Live shell: https://sara-qadi.github.io/fashion-elan-shell/

---

## 1. Vercel is not publishing your element bundle ← the blocking one

`vite.element.config.ts` writes to `dist-element/`, and Vercel publishes `dist/`.
So the URL the shell is supposed to use does not exist:

```
https://fashion-elan-category-discovery.vercel.app/elan-catalog-app.js
```

That URL returns **200 with `content-type: text/html`** — your `vercel.json`
rewrites everything to `index.html`, so a missing file looks like a successful
one. (A shell that did not check the content type would import the HTML as a
module, register nothing, and fail with no useful error.)

**The fix is one line.** Copy the element build into `dist/` at the end of the
build:

```jsonc
// package.json
"scripts": {
  "build": "tsc && vite build && vite build --config vite.element.config.ts && npm run copy:element",
  "copy:element": "node -e \"require('fs').copyFileSync('dist-element/elan-catalog-app.js','dist/elan-catalog-app.js')\""
}
```

Or simply set `outDir: 'dist'` with `emptyOutDir: false` in
`vite.element.config.ts` — either is fine, as long as the file ends up served
from the site root under that exact name, unhashed, forever.

**Until then**, the shell loads your bundle from jsDelivr instead, off the
`dist-element/` folder you committed:

```
https://cdn.jsdelivr.net/gh/Maha-hussam/fashion_elan_category_discovery@main/dist-element/elan-catalog-app.js
```

That works, but it serves whatever was last **committed**, not last deployed,
and it caches for hours. Please do not leave it as the real answer.

---

## 2. Accept an `embedded` prop so you do not render a second header

The shell renders the header, the category nav and the footer for all three
microfrontends — and it renders *your* header design, because it was the best
one. Your `App.tsx` still renders `<Navbar />` and `<Footer />` of its own, so
the composed page has two of each.

The shell currently hides yours with CSS from the outside:

```css
elan-catalog-app header.MuiAppBar-root,
elan-catalog-app footer { display: none !important; }
```

That works because your React tree is in the light DOM, but it is a hack that
breaks the moment MUI changes a class name. The clean version, which the Cart
app already does:

```tsx
// ElementApp.tsx — pass it down
<App embedded />

// App.tsx
export default function App({ embedded = false }: { embedded?: boolean }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: embedded ? 0 : '100vh' }}>
      <ScrollToTop />
      {!embedded && <Navbar />}
      <Box component="main" sx={{ flex: 1 }}>{/* routes */}</Box>
      {!embedded && <Footer />}
    </Box>
  )
}
```

`main.tsx` keeps rendering `<App />` with no prop, so the standalone site is
completely unchanged. Tell Sara when this ships and the CSS override comes out.

---

## 3. Replace the two `alert()` calls

`ProductDetailPage.tsx` uses `alert()` for "Please select a size" and "Please
select a colour". Two problems:

- The brief for this project says not to use `alert()` for normal UI feedback.
- A native alert blocks the whole page, including the other two microfrontends
  mounted alongside you. It froze the browser during integration testing.

An MUI `Snackbar`, or inline helper text under the size/colour group, is what
the rest of the storefront already uses.

---

## Contract reference (all of this is already working — do not change it)

### The shell owns the URL

Keep `MemoryRouter`. Do not call `history.pushState` or read `location` inside
the element. You read `route` and emit `elan:navigate`, which you already do.

### Routes the shell sends you

```
/            /catalog     /catalog/*
/product/*   /search      /category/*
```

The shell's header links to `/category/Women`, `/category/Men`, `/category/Kids`,
`/category/Shoes`, `/category/Bags`, `/category/Accessories`, and its search box
sends `/search?query=…` — both of which your `getAppRoute()` already maps onto
`/products?category=…` and `/products?search=…`.

### Events you emit

`elan:add-to-cart`, `elan:navigate`, `elan:product-selected`,
`elan:category-selected`, `elan:search-updated`, `elan:wishlist-toggle` — all on
`window`, with `bubbles` and `composed`, and `source: 'elan-catalog'`.

Your `elan:add-to-cart` payload uses `productName`, `color` and `size` where the
written contract said `name`, `selectedColor` and `selectedSize`. **Do not change
it** — the Cart app accepts both spellings now, and a rename would only break
what already works.

One field worth adding when convenient: **`imageUrl`**. Without it, items added
from your pages show a placeholder tile in the bag and in order history.

### Events you listen for

`elan:cart-updated`, `elan:user-logged-in`, `elan:user-logged-out`,
`elan:wishlist-updated`, and `elan:order-completed`.

Note you already switched to `elan:order-completed` — that is the agreed name.
The shell still re-emits it as `elan:checkout-completed` for compatibility, and
that alias will be deleted before submission.

---

## Definition of done

- [ ] `https://fashion-elan-category-discovery.vercel.app/elan-catalog-app.js` returns 200 with `content-type: application/javascript`
- [ ] The filename stays the same on every deploy
- [ ] `<App embedded />` in the element build renders no Navbar and no Footer
- [ ] The standalone site at the root URL is visually unchanged
- [ ] No `alert()` anywhere in the app
- [ ] (Nice to have) `elan:add-to-cart` includes `imageUrl`
