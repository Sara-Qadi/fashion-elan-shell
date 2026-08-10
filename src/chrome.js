/**
 * The shell's own UI: the header the three microfrontends share, and a small
 * event inspector that makes the integration visible during the demo.
 *
 * Deliberately plain DOM. The shell must not favour React, Vue or Lit — it only
 * does integration, so bringing a framework in would be the wrong signal.
 */
import { toBrowserPath } from './basePath.js'
import { onAnyEvent } from './bus.js'
import { MICROFRONTENDS } from './registry.js'
import { navigate } from './router.js'

/**
 * The categories the Catalog app knows about, in its own order. Each one is a
 * /category/ route, which the registry gives to Catalog and which its
 * element maps onto its internal /products?category=… view.
 */
const CATEGORIES = [
  'Women',
  'Men',
  'Kids',
  'Shoes',
  'Bags',
  'Accessories',
]

/**
 * Inline icons so the shared header does not depend on another icon library.
 *
 * IMPORTANT:
 * The shell CSS expects:
 *
 * fill: none
 * stroke: currentColor
 *
 * so these icons stay line-based.
 */
const ICONS = {
  search: `
    <circle cx="11" cy="11" r="6"></circle>
    <path d="m16 16 4 4"></path>
  `,

  heart: `
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"></path>
  `,

  person: `
    <circle cx="12" cy="8" r="4"></circle>
    <path d="M5 21v-2a7 7 0 0 1 14 0v2"></path>
  `,

  bag: `
    <path d="M6 8h12l1 13H5L6 8Z"></path>
    <path d="M9 8V6a3 3 0 0 1 6 0v2"></path>
  `,
}

function icon(name) {
  return `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      ${ICONS[name]}
    </svg>
  `
}

/**
 * Shared ELAN header.
 */
function renderHeader() {
  const categories = CATEGORIES.map(
    (name) => `
      <a
        href="${toBrowserPath(`/category/${encodeURIComponent(name)}`)}"
        data-shell-link
        data-category="${name}"
      >
        ${name}
      </a>
    `,
  ).join('')

  return `
    <div class="elan-shell-promo">
      FREE STANDARD SHIPPING OVER $150 · USE CODE: ELAN10 FOR 10% OFF
    </div>

    <header class="elan-shell-header">

      <nav
        class="elan-shell-nav"
        aria-label="Shop categories"
      >
        ${categories}
      </nav>

      <a
        class="elan-shell-brand"
        href="${toBrowserPath('/')}"
        data-shell-link
        aria-label="ELAN home"
      >
        ELAN
      </a>

      <div class="elan-shell-actions">

        <button
          class="elan-shell-icon-btn"
          type="button"
          data-search-toggle
          aria-label="Search"
          aria-expanded="false"
        >
          ${icon('search')}
        </button>

        <a
          class="elan-shell-icon-btn"
          href="${toBrowserPath('/wishlist')}"
          data-shell-link
          data-nav="wishlist"
          aria-label="Wishlist"
        >
          ${icon('heart')}
        </a>

        <a
          class="elan-shell-icon-btn"
          href="${toBrowserPath('/account')}"
          data-shell-link
          data-nav="account"
          aria-label="Account"
        >
          ${icon('person')}
        </a>

        <a
          class="elan-shell-icon-btn elan-shell-icon-btn--bag"
          href="${toBrowserPath('/cart')}"
          data-shell-link
          data-nav="cart"
          aria-label="Shopping bag"
        >
          ${icon('bag')}

          <span
            class="elan-shell-bag__count"
            data-bag-count
            hidden
          >
            0
          </span>
        </a>

      </div>

    </header>

    <form
      class="elan-shell-searchbar"
      role="search"
      data-search
      hidden
    >

      <input
        class="elan-shell-searchbar__input"
        type="search"
        name="query"
        placeholder="Search for a piece…"
        autocomplete="off"
        aria-label="Search products"
      />

      <button
        class="elan-shell-searchbar__submit"
        type="submit"
      >
        Search
      </button>

    </form>
  `
}

/**
 * The shell suppresses each microfrontend's own footer along with its header,
 * so it supplies one shared footer.
 */
function renderFooter() {
  const shop = CATEGORIES.map(
    (name) => `
      <li>
        <a
          href="${toBrowserPath(`/category/${encodeURIComponent(name)}`)}"
          data-shell-link
        >
          ${name}
        </a>
      </li>
    `,
  ).join('')

  const apps = MICROFRONTENDS.map(
    (app) => `
      <li>
        <a
          href="${toBrowserPath(app.home)}"
          data-shell-link
        >
          ${app.label}
        </a>

        <span class="elan-shell-footer__owner">
          ${app.framework}
        </span>
      </li>
    `,
  ).join('')

  return `
    <footer class="elan-shell-footer">

      <div class="elan-shell-footer__grid">

        <div>
          <p class="elan-shell-footer__brand">
            ELAN
          </p>

          <p class="elan-shell-footer__blurb">
            Three independently deployed microfrontends,
            composed as one storefront.
          </p>
        </div>

        <div>
          <h2>Shop</h2>

          <ul>
            ${shop}
          </ul>
        </div>

        <div>
          <h2>This build</h2>

          <ul>
            ${apps}
          </ul>
        </div>

      </div>

      <p class="elan-shell-footer__legal">
        ELAN · University microfrontend project ·
        Payments are mocked and no card data leaves the browser.
      </p>

    </footer>
  `
}

/**
 * Event inspector shown during the integration demo.
 */
function renderInspector() {
  return `
    <aside
      class="elan-shell-inspector"
      data-inspector
      hidden
    >

      <div class="elan-shell-inspector__head">

        <strong>
          Event bus
        </strong>

        <button
          type="button"
          data-inspector-close
          aria-label="Close"
        >
          ×
        </button>

      </div>

      <ol
        class="elan-shell-inspector__list"
        data-inspector-list
      >
        <li class="elan-shell-inspector__empty">
          Nothing yet. Interact with the app.
        </li>
      </ol>

    </aside>

    <button
      class="elan-shell-inspector__toggle"
      type="button"
      data-inspector-open
    >
      Events

      <span data-inspector-count>
        0
      </span>
    </button>
  `
}

export function mountChrome() {
  document.getElementById('elan-chrome').innerHTML =
    renderHeader()

  document.getElementById('elan-shell-footer').innerHTML =
    renderFooter()

  document.getElementById('elan-inspector-root').innerHTML =
    renderInspector()

  const bagCount =
    document.querySelector('[data-bag-count]')

  /**
   * The bag badge lives in the shell, but Cart owns the actual cart state.
   */
  const REMEMBERED = 'elan.shell.bag-count'

  const setBagCount = (value) => {
    const count = Number(value) || 0

    bagCount.textContent =
      String(count)

    bagCount.hidden =
      count === 0

    try {
      sessionStorage.setItem(
        REMEMBERED,
        String(count),
      )
    } catch {
      // Badge continues to work in the current page.
    }
  }

  setBagCount(
    sessionStorage.getItem(REMEMBERED) ?? 0,
  )

  const list =
    document.querySelector(
      '[data-inspector-list]',
    )

  const panel =
    document.querySelector(
      '[data-inspector]',
    )

  const counter =
    document.querySelector(
      '[data-inspector-count]',
    )

  let seen = 0

  /**
   * Shared Catalog search.
   */
  const searchBar =
    document.querySelector(
      '[data-search]',
    )

  const searchToggle =
    document.querySelector(
      '[data-search-toggle]',
    )

  searchToggle.addEventListener(
    'click',
    () => {
      /**
       * Search is Catalog-only.
       */
      if (
        document.body.dataset.activeApp !==
        'catalog'
      ) {
        return
      }

      const open =
        searchBar.hidden

      searchBar.hidden =
        !open

      searchToggle.setAttribute(
        'aria-expanded',
        String(open),
      )

      if (open) {
        searchBar
          .querySelector('input')
          .focus()
      }
    },
  )

  searchBar.addEventListener(
    'submit',
    (event) => {
      event.preventDefault()

      const input =
        searchBar.querySelector('input')

      const query =
        input.value.trim()

      if (!query) {
        return
      }

      navigate(
        `/search?query=${encodeURIComponent(query)}`,
      )

      searchBar.hidden = true

      searchToggle.setAttribute(
        'aria-expanded',
        'false',
      )

      input.value = ''
    },
  )

  /**
   * Event inspector.
   */
  document
    .querySelector('[data-inspector-open]')
    .addEventListener(
      'click',
      () => {
        panel.hidden = false
      },
    )

  document
    .querySelector('[data-inspector-close]')
    .addEventListener(
      'click',
      () => {
        panel.hidden = true
      },
    )

  /**
   * Router announces this after route changes.
   *
   * This is what allows the Heart / Account active state to change
   * immediately without Refresh.
   */
  window.addEventListener(
    'elan:shell-route-changed',
    () => {
      syncNav()
    },
  )

  /**
   * Global event inspector + bag updates.
   */
  onAnyEvent((name, detail = {}) => {
    if (
      name === 'elan:cart-updated' &&
      typeof detail.itemCount === 'number'
    ) {
      setBagCount(
        detail.itemCount,
      )
    }

    if (
      name === 'elan:order-completed'
    ) {
      setBagCount(0)
    }

    seen += 1

    counter.textContent =
      String(seen)

    const entry =
      document.createElement('li')

    entry.innerHTML = `
      <code>
        ${escapeHtml(name)}
      </code>

      <span>
        ${escapeHtml(summarize(detail))}
      </span>
    `

    list
      .querySelector(
        '.elan-shell-inspector__empty',
      )
      ?.remove()

    list.prepend(entry)

    while (
      list.children.length > 40
    ) {
      list.lastElementChild.remove()
    }
  })

  /**
   * Initial active-state sync.
   */
  syncNav()
}

function summarize(detail) {
  const copy = {
    ...detail,
  }

  delete copy.source

  const text =
    JSON.stringify(copy)

  return text.length > 120
    ? `${text.slice(0, 117)}…`
    : text
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      `&#${character.charCodeAt(0)};`,
  )
}

/**
 * Synchronize shared header active state.
 *
 * Wishlist belongs technically to Account MFE, but visually Heart should be
 * active instead of the Account/person icon.
 */
export function syncNav() {
  const active =
    document.body.dataset.activeApp

  const rawPath =
    document.body.dataset.appPath ||
    window.location.pathname

  let path =
    rawPath

  try {
    path =
      decodeURIComponent(rawPath)
  } catch {
    path =
      rawPath
  }

  const pathname =
    path.split('?')[0]

  /**
   * Wishlist may be represented as either route depending on the route contract.
   */
  const isWishlist =
    pathname === '/wishlist' ||
    pathname === '/account/wishlist'

  /**
   * Cart routes.
   */
  const isCart =
    active === 'cart' ||
    pathname === '/cart' ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/order-confirmation')

  /**
   * Account is active for Account pages EXCEPT Wishlist.
   */
  const isAccount =
    active === 'account' &&
    !isWishlist

  for (
    const node of
    document.querySelectorAll(
      '[data-nav]',
    )
  ) {
    const nav =
      node.dataset.nav

    let shouldBeActive =
      false

    if (
      nav === 'wishlist'
    ) {
      shouldBeActive =
        isWishlist
    }

    if (
      nav === 'account'
    ) {
      shouldBeActive =
        isAccount
    }

    if (
      nav === 'cart'
    ) {
      shouldBeActive =
        isCart
    }

    node.classList.toggle(
      'is-active',
      shouldBeActive,
    )

    if (
      shouldBeActive
    ) {
      node.setAttribute(
        'aria-current',
        'page',
      )
    } else {
      node.removeAttribute(
        'aria-current',
      )
    }
  }

  /**
   * Search belongs ONLY to Catalog.
   */
  const searchToggle =
    document.querySelector(
      '[data-search-toggle]',
    )

  const searchBar =
    document.querySelector(
      '[data-search]',
    )

  const searchInput =
    searchBar?.querySelector(
      'input',
    )

  const catalogActive =
    active === 'catalog'

  if (
    searchToggle
  ) {
    searchToggle.hidden =
      !catalogActive
  }

  if (
    !catalogActive &&
    searchBar
  ) {
    searchBar.hidden =
      true

    searchToggle?.setAttribute(
      'aria-expanded',
      'false',
    )

    if (
      searchInput
    ) {
      searchInput.value =
        ''
    }
  }

  /**
   * Category highlighting.
   *
   * Supports:
   *
   * /category/Men
   *
   * and:
   *
   * /catalog?category=Men
   */
  const categoryMatch =
    pathname.match(
      /\/category\/([^/?]+)/,
    )

  let currentCategory =
    categoryMatch?.[1] ??
    null

  if (
    !currentCategory
  ) {
    try {
      currentCategory =
        new URLSearchParams(
          path.includes('?')
            ? path.slice(
                path.indexOf('?'),
              )
            : window.location.search,
        ).get('category')
    } catch {
      currentCategory =
        null
    }
  }

  for (
    const link of
    document.querySelectorAll(
      '[data-category]',
    )
  ) {
    link.classList.toggle(
      'is-current',
      catalogActive &&
        link.dataset.category ===
          currentCategory,
    )
  }
}