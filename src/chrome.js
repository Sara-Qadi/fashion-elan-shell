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
 * /category/<name> route, which the registry gives to Catalog and which its
 * element maps onto its internal /products?category=… view.
 */
const CATEGORIES = ['Women', 'Men', 'Kids', 'Shoes', 'Bags', 'Accessories']

/** Inline so the header needs no icon font and paints with the first byte. */
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  heart:
    '<path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7C19 15.6 12 20 12 20Z"/>',
  person: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6"/>',
  bag: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9.5 8V6.5a2.5 2.5 0 0 1 5 0V8"/>',
}

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`
}

function renderHeader() {
  const categories = CATEGORIES.map(
    (name) =>
      `<a href="${toBrowserPath(`/category/${encodeURIComponent(name)}`)}"
          data-shell-link data-category="${name}">${name}</a>`,
  ).join('')

  // data-nav marks the three app entry points so syncNav can highlight the one
  // currently mounted, whichever control it happens to be.
  return `
    <div class="elan-promo">FREE STANDARD SHIPPING OVER $150 · USE CODE: ELAN10 FOR 10% OFF</div>
    <header class="elan-header">
      <nav class="elan-nav" aria-label="Shop by category" data-nav="catalog">${categories}</nav>

      <a class="elan-brand" href="${toBrowserPath('/')}" data-shell-link aria-label="ELAN home">
        ELAN
      </a>

      <div class="elan-actions">
        <button class="elan-icon-btn" type="button" data-search-toggle
                aria-label="Search" aria-expanded="false">${icon('search')}</button>

        <a class="elan-icon-btn" href="${toBrowserPath('/wishlist')}" data-shell-link
           aria-label="Wishlist">${icon('heart')}</a>

        <a class="elan-icon-btn" href="${toBrowserPath('/account')}" data-shell-link
           data-nav="account" aria-label="Account">${icon('person')}</a>

        <a class="elan-icon-btn elan-icon-btn--bag" href="${toBrowserPath('/cart')}" data-shell-link
           data-nav="cart" aria-label="Shopping bag">
          ${icon('bag')}<span class="elan-bag__count" data-bag-count hidden>0</span>
        </a>
      </div>
    </header>

    <form class="elan-searchbar" role="search" data-search hidden>
      <input class="elan-searchbar__input" type="search" name="query"
             placeholder="Search for a piece…" autocomplete="off" aria-label="Search products" />
      <button class="elan-searchbar__submit" type="submit">Search</button>
    </form>
  `
}

/**
 * The shell suppresses each microfrontend's own footer along with its header
 * (see chrome-suppression in styles.css), so it has to supply one — otherwise
 * the composed page just stops at the bottom of whatever is mounted.
 */
function renderFooter() {
  const shop = CATEGORIES.map(
    (name) =>
      `<li><a href="${toBrowserPath(`/category/${encodeURIComponent(name)}`)}" data-shell-link>${name}</a></li>`,
  ).join('')

  const apps = MICROFRONTENDS.map(
    (app) =>
      `<li><a href="${toBrowserPath(app.home)}" data-shell-link>${app.label}</a>
        <span class="elan-footer__owner">${app.framework}</span></li>`,
  ).join('')

  return `
    <footer class="elan-footer">
      <div class="elan-footer__grid">
        <div>
          <p class="elan-footer__brand">ELAN</p>
          <p class="elan-footer__blurb">
            Three independently deployed microfrontends, composed as one storefront.
          </p>
        </div>
        <div>
          <h2>Shop</h2>
          <ul>${shop}</ul>
        </div>
        <div>
          <h2>This build</h2>
          <ul>${apps}</ul>
        </div>
      </div>
      <p class="elan-footer__legal">
        ELAN · University microfrontend project · Payments are mocked and no card data leaves the browser.
      </p>
    </footer>
  `
}

function renderInspector() {
  return `
    <aside class="elan-inspector" data-inspector hidden>
      <div class="elan-inspector__head">
        <strong>Event bus</strong>
        <button type="button" data-inspector-close aria-label="Close">×</button>
      </div>
      <ol class="elan-inspector__list" data-inspector-list>
        <li class="elan-inspector__empty">Nothing yet. Interact with the app.</li>
      </ol>
    </aside>
    <button class="elan-inspector__toggle" type="button" data-inspector-open>
      Events <span data-inspector-count>0</span>
    </button>
  `
}

export function mountChrome() {
  document.getElementById('elan-chrome').innerHTML = renderHeader()
  document.getElementById('elan-footer').innerHTML = renderFooter()
  document.getElementById('elan-inspector-root').innerHTML = renderInspector()

  const bagCount = document.querySelector('[data-bag-count]')

  // The bag badge lives in the shell, but only the Cart element knows the count.
  // The shell keeps that element mounted so the number stays live on every page
  // — this remembers it across reloads so the badge is right on first paint,
  // before the Cart bundle has finished loading.
  const REMEMBERED = 'elan.shell.bag-count'

  const setBagCount = (value) => {
    const count = Number(value) || 0
    bagCount.textContent = String(count)
    bagCount.hidden = count === 0
    try {
      sessionStorage.setItem(REMEMBERED, String(count))
    } catch {
      // Private mode or a full quota: the badge is still correct in-page.
    }
  }

  setBagCount(sessionStorage.getItem(REMEMBERED) ?? 0)
  const list = document.querySelector('[data-inspector-list]')
  const panel = document.querySelector('[data-inspector]')
  const counter = document.querySelector('[data-inspector-count]')
  let seen = 0

  // Search belongs to Catalog, but the input lives up here because the header is
  // shared. /search?query=… is part of the route contract Catalog already maps
  // onto its own /products?search=…, so the shell does not need to know that.
  const searchBar = document.querySelector('[data-search]')
  const searchToggle = document.querySelector('[data-search-toggle]')

  searchToggle.addEventListener('click', () => {
    const open = searchBar.hidden
    searchBar.hidden = !open
    searchToggle.setAttribute('aria-expanded', String(open))
    if (open) searchBar.querySelector('input').focus()
  })

  searchBar.addEventListener('submit', (event) => {
    event.preventDefault()
    const input = searchBar.querySelector('input')
    const query = input.value.trim()
    if (!query) return
    navigate(`/search?query=${encodeURIComponent(query)}`)
    searchBar.hidden = true
    searchToggle.setAttribute('aria-expanded', 'false')
    input.value = ''
  })

  document.querySelector('[data-inspector-open]').addEventListener('click', () => {
    panel.hidden = false
  })
  document.querySelector('[data-inspector-close]').addEventListener('click', () => {
    panel.hidden = true
  })

  onAnyEvent((name, detail) => {
    // The cart badge is the clearest proof that two microfrontends are talking.
    if (name === 'elan:cart-updated' && typeof detail.itemCount === 'number') {
      setBagCount(detail.itemCount)
    }
    if (name === 'elan:order-completed') setBagCount(0)

    seen += 1
    counter.textContent = String(seen)

    const entry = document.createElement('li')
    entry.innerHTML = `<code>${name}</code><span>${escapeHtml(summarize(detail))}</span>`
    list.querySelector('.elan-inspector__empty')?.remove()
    list.prepend(entry)
    while (list.children.length > 40) list.lastElementChild.remove()
  })
}

function summarize(detail) {
  const copy = { ...detail }
  delete copy.source
  const text = JSON.stringify(copy)
  return text.length > 120 ? `${text.slice(0, 117)}…` : text
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** Keeps the control for the mounted microfrontend highlighted. */
export function syncNav() {
  const active = document.body.dataset.activeApp
  for (const node of document.querySelectorAll('[data-nav]')) {
    node.classList.toggle('is-active', node.dataset.nav === active)
  }

  // Within Catalog, highlight the category actually being browsed. Two URL
  // shapes mean the same thing: the shell links to /category/Men, and Catalog
  // reports its own view back as /catalog?category=Men once it has navigated.
  const current =
    decodeURIComponent(location.pathname).match(/\/category\/([^/?]+)/)?.[1] ??
    new URLSearchParams(location.search).get('category')

  for (const link of document.querySelectorAll('[data-category]')) {
    link.classList.toggle('is-current', link.dataset.category === current)
  }
}
