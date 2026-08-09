/**
 * The three microfrontends, and nothing else.
 *
 * This file is the whole integration contract in code form. Changing a live URL
 * or a tag name should never require touching anything but this table.
 *
 * `bundle` is the entry the team agreed on: a stable, unhashed filename served
 * from the app's own origin. `extraEntries` lists URLs to try when that one is
 * not published yet, and the loader can still fall back to reading the app's
 * index.html for its hashed entry (see loader.js).
 */
export const MICROFRONTENDS = [
  {
    id: 'catalog',
    // The `source` field on every elan:* event this app emits.
    source: 'elan-catalog',
    label: 'Shop',
    owner: 'Maha Hussam',
    framework: 'React + MUI',
    tag: 'elan-catalog-app',
    origin: 'https://fashion-elan-category-discovery.vercel.app',
    bundle: '/elan-catalog-app.js',
    repo: 'https://github.com/Maha-hussam/fashion_elan_category_discovery',

    // The element build is real and correct, but it writes to dist-element/
    // while Vercel publishes dist/ — so the agreed URL above 404s (and Vercel's
    // SPA rewrite answers with index.html, which is why it must be content-type
    // checked). The built file *is* committed to the repo, so jsDelivr can serve
    // it with a correct JavaScript content type until the copy step is added.
    extraEntries: [
      'https://cdn.jsdelivr.net/gh/Maha-hussam/fashion_elan_category_discovery@main/dist-element/elan-catalog-app.js',
    ],

    // Rendered in the light DOM by @r2wc/react-to-web-component, so the shell
    // can reach in and suppress the app's own header. See chromeSuppression.css.
    rendersOwnChrome: true,

    // Paths this microfrontend renders. Longest match wins, so order is only
    // documentation here.
    owns: ['/', '/catalog', '/product', '/search', '/category'],
    home: '/',
  },
  {
    id: 'cart',
    // The `source` field on every elan:* event this app emits.
    source: 'elan-cart-checkout',
    label: 'Bag',
    owner: 'Sara Qadi',
    framework: 'Vue 3 + Vuetify',
    tag: 'elan-cart-app',
    origin: 'https://sara-qadi.github.io/fashion-elan-card-checkout',
    bundle: '/elan-cart-app.js',
    repo: 'https://github.com/Sara-Qadi/fashion-elan-card-checkout',

    // Hides its own header and footer when the shell sets embedded, so nothing
    // needs suppressing from out here.
    rendersOwnChrome: false,

    // Owns the bag, and the bag is filled from the Catalog page. Its listener
    // only exists while the element is on the page, so the shell keeps it there.
    listensWhileHidden: true,

    owns: ['/cart', '/checkout', '/order-confirmation'],
    home: '/cart',
  },
  {
    id: 'account',
    // The `source` field on every elan:* event this app emits.
    source: 'elan-account',
    label: 'Account',
    owner: 'Mais Arman',
    framework: 'Lit + Material Web',
    tag: 'elan-account-app',
    origin: 'https://fashion-elan-account-orders.vercel.app',

    // Published under /mfe/, not at the root: her element config sets
    // outDir 'dist/mfe'. The contract asked for /elan-account-app.js; this is
    // the URL that actually exists, and the table is the right place to absorb
    // that rather than making her rename a working build.
    bundle: '/mfe/elan-account.js',
    repo: 'https://github.com/mais-arman/fashion-elan-account-orders',

    // She also publishes /mfe/elan-account.css, and the shell deliberately does
    // NOT load it: it is 17MB (12.8MB even compressed) because material-symbols
    // inlines its webfont as base64. Her Lit components carry their own styles
    // inside the bundle, so the only thing that file provides which a shadow
    // root cannot is the @font-face — and styles.js declares that from a CDN in
    // about a kilobyte instead.
    iconFont: 'material-symbols',

    rendersOwnChrome: false,

    // Files completed orders into its history from `elan:order-completed`,
    // which is emitted on the Cart's confirmation route, not on one of hers.
    listensWhileHidden: true,

    // Alone among the three, this app does not move itself while embedded: it
    // emits `elan:navigate` and then waits for the shell to set `route`. Its
    // own sidebar links do nothing until the shell answers.
    awaitsRouteEcho: true,

    owns: [
      '/account',
      '/login',
      '/register',
      '/orders',
      '/wishlist',
      '/profile',
      '/reviews',
    ],
    home: '/account',
  },
]

/** Every URL worth trying for an app, best first. */
export function entryCandidates(app) {
  return [`${app.origin}${app.bundle}`, ...(app.extraEntries ?? [])]
}

/** Longest-prefix match, so /orders never gets stolen by a shorter pattern. */
export function resolveApp(pathname) {
  let best = null
  let bestLength = -1

  for (const app of MICROFRONTENDS) {
    for (const prefix of app.owns) {
      const matches = prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`)
      if (matches && prefix.length > bestLength) {
        best = app
        bestLength = prefix.length
      }
    }
  }

  return best
}

export function getApp(id) {
  return MICROFRONTENDS.find((app) => app.id === id) ?? null
}

/**
 * Which app emitted an event, from the `source` every elan:* payload carries.
 * Returns null for a source the shell does not know, including its own.
 */
export function appBySource(source) {
  if (!source) return null
  return MICROFRONTENDS.find((app) => app.source === source) ?? null
}
