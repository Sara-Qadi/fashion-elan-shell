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

function renderHeader() {
  const nav = MICROFRONTENDS.map(
    (app) =>
      `<a href="${toBrowserPath(app.home)}" data-shell-link data-nav="${app.id}">${app.label}</a>`,
  ).join('')

  return `
    <div class="elan-promo">FREE STANDARD SHIPPING OVER $150 · USE CODE ELAN10 FOR 10% OFF</div>
    <header class="elan-header">
      <a class="elan-brand" href="${toBrowserPath('/')}" data-shell-link>
        <span class="elan-brand__mark">E</span>
        <span class="elan-brand__word">ELAN</span>
      </a>
      <nav class="elan-nav">${nav}</nav>
      <button class="elan-bag" type="button" data-bag>
        Bag <span class="elan-bag__count" data-bag-count>0</span>
      </button>
    </header>
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
  document.getElementById('elan-inspector-root').innerHTML = renderInspector()

  const bagCount = document.querySelector('[data-bag-count]')
  const list = document.querySelector('[data-inspector-list]')
  const panel = document.querySelector('[data-inspector]')
  const counter = document.querySelector('[data-inspector-count]')
  let seen = 0

  document.querySelector('[data-bag]').addEventListener('click', () => navigate('/cart'))
  document.querySelector('[data-inspector-open]').addEventListener('click', () => {
    panel.hidden = false
  })
  document.querySelector('[data-inspector-close]').addEventListener('click', () => {
    panel.hidden = true
  })

  onAnyEvent((name, detail) => {
    // The cart badge is the clearest proof that two microfrontends are talking.
    if (name === 'elan:cart-updated' && typeof detail.itemCount === 'number') {
      bagCount.textContent = String(detail.itemCount)
    }
    if (name === 'elan:order-completed') bagCount.textContent = '0'

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

/** Keeps the active nav item highlighted as the route changes. */
export function syncNav() {
  const active = document.body.dataset.activeApp
  for (const link of document.querySelectorAll('[data-nav]')) {
    link.classList.toggle('is-active', link.dataset.nav === active)
  }
}
