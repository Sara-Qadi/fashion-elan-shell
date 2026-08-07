/**
 * The three microfrontends, and nothing else.
 *
 * This file is the whole integration contract in code form.
 * Changing a live URL or a tag name should never require
 * touching anything but this table.
 *
 * `bundle` is the preferred entry: a stable, unhashed
 * filename each team publishes.
 *
 * `styles` is optional and is loaded by loader.js when
 * a microfrontend requires global CSS outside its shadow root.
 */

export const MICROFRONTENDS = [
  {
    id: 'catalog',
    label: 'Shop',
    owner: 'Maha Hussam',
    framework: 'React + MUI',
    tag: 'elan-catalog-app',

    origin:
      'https://fashion-elan-category-discovery.vercel.app',

    bundle:
      '/elan-catalog-app.js',

    styles: null,

    repo:
      'https://github.com/Maha-hussam/fashion_elan_category_discovery',

    owns: [
      '/',
      '/catalog',
      '/product',
      '/search',
      '/category',
    ],

    home: '/',
  },

  {
    id: 'cart',
    label: 'Bag',
    owner: 'Sara Qadi',
    framework: 'Vue 3 + Vuetify',
    tag: 'elan-cart-app',

    origin:
      'https://sara-qadi.github.io/fashion-elan-card-checkout',

    bundle:
      '/elan-cart-app.js',

    styles: null,

    repo:
      'https://github.com/Sara-Qadi/fashion-elan-card-checkout',

    owns: [
      '/cart',
      '/checkout',
      '/order-confirmation',
    ],

    home: '/cart',
  },

  {
    id: 'account',
    label: 'Account',
    owner: 'Mais Arman',
    framework: 'Lit + Material Web',
    tag: 'elan-account-app',

    origin:
      'https://fashion-elan-account-orders.vercel.app',

    bundle:
      '/mfe/elan-account.js',

    styles:
      '/mfe/elan-account.css',

    repo:
      'https://github.com/mais-arman/fashion-elan-account-orders',

    owns: [
      '/account',
      '/login',
      '/register',
      '/profile',
      '/orders',
      '/wishlist',
      '/reviews',
    ],

    home: '/account',
  },
];

/**
 * Longest-prefix match.
 */
export function resolveApp(
  pathname,
) {
  let best = null;
  let bestLength = -1;

  for (
    const app of MICROFRONTENDS
  ) {
    for (
      const prefix of app.owns
    ) {
      const matches =
        prefix === '/'
          ? pathname === '/'
          : pathname ===
              prefix ||
            pathname.startsWith(
              `${prefix}/`,
            );

      if (
        matches &&
        prefix.length >
          bestLength
      ) {
        best = app;
        bestLength =
          prefix.length;
      }
    }
  }

  return best;
}

export function getApp(id) {
  return (
    MICROFRONTENDS.find(
      (app) =>
        app.id === id,
    ) ?? null
  );
}