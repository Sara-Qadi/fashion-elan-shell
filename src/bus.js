/**
 * Event bus between the three ELAN microfrontends.
 *
 * Every application communicates using browser
 * CustomEvents.
 *
 * The Shell primarily observes and logs events.
 *
 * Aliases exist only for temporary compatibility
 * between older event contracts.
 */

const ALIASES = {
  /*
   * Cart emits:
   *
   * elan:order-completed
   *
   * An older Catalog contract expected:
   *
   * elan:checkout-completed
   */
  'elan:order-completed': [
    'elan:checkout-completed',
  ],

  /*
   * Temporary Cart navigation event.
   */
  'elan:navigate-catalog': [
    'elan:navigate',
  ],
};

export const WATCHED = [
  'elan:cart-updated',

  'elan:checkout-started',

  'elan:order-completed',

  'elan:order-history-updated',

  'elan:checkout-completed',

  'elan:add-to-cart',

  'elan:product-selected',

  'elan:category-selected',

  'elan:search-updated',

  'elan:wishlist-item-added',

  'elan:wishlist-item-removed',

  'elan:wishlist-updated',

  'elan:review-submitted',

  'elan:user-logged-in',

  'elan:user-registered',

  'elan:user-logged-out',

  'elan:profile-updated',

  'elan:navigate',

  'elan:navigate-catalog',
];

const listeners =
  new Set();

const RELAYED =
  Symbol.for(
    'elan.shell.relayed',
  );

export function startBus() {
  for (
    const name of WATCHED
  ) {
    window.addEventListener(
      name,
      (event) => {
        const detail =
          event.detail ?? {};

        for (
          const listener of
          listeners
        ) {
          listener(
            name,
            detail,
            event,
          );
        }

        if (
          detail[RELAYED]
        ) {
          return;
        }

        for (
          const alias of
          ALIASES[name] ?? []
        ) {
          window.dispatchEvent(
            new CustomEvent(
              alias,
              {
                detail: {
                  ...detail,

                  [RELAYED]:
                    true,

                  aliasedFrom:
                    name,
                },

                bubbles: true,

                composed: true,
              },
            ),
          );
        }
      },
    );
  }
}

export function onAnyEvent(
  listener,
) {
  listeners.add(
    listener,
  );

  return () =>
    listeners.delete(
      listener,
    );
}

export function emit(
  name,
  detail = {},
) {
  window.dispatchEvent(
    new CustomEvent(
      name,
      {
        detail: {
          source:
            'elan-shell',

          ...detail,
        },

        bubbles: true,

        composed: true,
      },
    ),
  );
}