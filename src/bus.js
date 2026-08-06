/**
 * The event bus between the three microfrontends.
 *
 * Every app already talks in `elan:*` CustomEvents on window with bubbles and
 * composed set, so the bus is mostly a listener — it does not need to forward
 * anything that is already on window.
 *
 * What it DOES do is translate the names the three contracts disagreed on.
 * Rather than making three teams re-deploy to rename an event, the shell
 * re-emits under the alias so both spellings arrive. Aliases are a migration
 * aid, not the contract: once every app uses the agreed name, delete them.
 */

/** Emitted name -> extra names to re-emit it as. */
const ALIASES = {
  // Catalog listens for `elan:checkout-completed`; Cart emits
  // `elan:order-completed`; Account also expects `elan:order-completed`.
  'elan:order-completed': ['elan:checkout-completed'],
  // Cart's narrower "take me back to the catalog" maps onto the shared name
  // that Catalog and Account both already emit.
  'elan:navigate-catalog': ['elan:navigate'],
}

/** Every event name the shell watches, for logging and for the debug panel. */
export const WATCHED = [
  'elan:cart-updated',
  'elan:checkout-started',
  'elan:order-completed',
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
]

const listeners = new Set()

/** Marks events the shell itself re-emitted, so aliasing cannot loop. */
const RELAYED = Symbol.for('elan.shell.relayed')

export function startBus() {
  for (const name of WATCHED) {
    window.addEventListener(name, (event) => {
      const detail = event.detail ?? {}

      for (const listener of listeners) listener(name, detail, event)

      if (detail[RELAYED]) return

      for (const alias of ALIASES[name] ?? []) {
        window.dispatchEvent(
          new CustomEvent(alias, {
            detail: { ...detail, [RELAYED]: true, aliasedFrom: name },
            bubbles: true,
            composed: true,
          }),
        )
      }
    })
  }
}

/** Subscribe to everything the bus sees. Returns an unsubscribe function. */
export function onAnyEvent(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emit(name, detail = {}) {
  window.dispatchEvent(
    new CustomEvent(name, { detail: { source: 'elan-shell', ...detail }, bubbles: true, composed: true }),
  )
}
