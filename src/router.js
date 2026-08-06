/**
 * The shell owns the URL. The microfrontends do not.
 *
 * This is the single most important rule of the integration: three apps each
 * running their own history router in one page would all listen to popstate and
 * fight over location. So each app runs on an in-memory router and is told where
 * it is through a `route` property; when it navigates internally it reports back
 * with an `elan:navigate` event, which the shell turns into a real URL change.
 */
import { currentAppPath, toAppPath, toBrowserPath } from './basePath.js'
import { loadMicrofrontend } from './loader.js'
import { MICROFRONTENDS, resolveApp } from './registry.js'

const outlet = () => document.getElementById('elan-outlet')

let current = { id: null, element: null }

function setStatus(html, tone = 'info') {
  const node = outlet()
  node.innerHTML = `<div class="elan-status elan-status--${tone}">${html}</div>`
}

function failureMessage(app, error) {
  return `
    <h2>${app.label} is not published as a custom element yet</h2>
    <p>
      The shell asked <code>${app.origin}${app.bundle}</code> for
      <code>&lt;${app.tag}&gt;</code> and could not get it.
    </p>
    <p class="elan-status__detail">${String(error.message ?? error)}</p>
    <p>
      This is expected until ${app.owner} publishes the element build.
      The instructions are in <code>docs/</code> of the shell repo, and the other
      microfrontends keep working in the meantime.
    </p>
    <p><a href="${app.origin}" target="_blank" rel="noreferrer">Open ${app.label} standalone</a></p>
  `
}

/**
 * Mounting is per-app, not per-navigation: switching from /cart to
 * /checkout/shipping must not tear the element down, or the shopper would lose
 * everything they typed. Only a change of *app* replaces the element.
 */
async function mount(app, pathname) {
  if (current.id === app.id && current.element) {
    current.element.setAttribute('route', pathname)
    return
  }

  setStatus(`<p class="elan-status__loading">Loading ${app.label}…</p>`, 'loading')

  try {
    await loadMicrofrontend(app)
  } catch (error) {
    setStatus(failureMessage(app, error), 'error')
    current = { id: null, element: null }
    return
  }

  const element = document.createElement(app.tag)
  element.setAttribute('route', pathname)
  element.dataset.elanApp = app.id

  const node = outlet()
  node.innerHTML = ''
  node.appendChild(element)

  current = { id: app.id, element }
  document.body.dataset.activeApp = app.id
}

/** Takes an APP path (/cart), not a browser path (/fashion-elan-shell/cart). */
export function navigate(appPath, { replace = false } = {}) {
  const url = toBrowserPath(appPath)
  if (url === location.pathname + location.search) return

  if (replace) history.replaceState({}, '', url)
  else history.pushState({}, '', url)

  render()
}

export function render() {
  const appPath = currentAppPath()
  const app = resolveApp(toAppPath())

  if (!app) {
    setStatus(
      `<h2>404</h2><p>No microfrontend owns <code>${escapeHtml(appPath)}</code>.</p>
       <p><a href="${toBrowserPath('/')}" data-shell-link>Back to the shop</a></p>`,
      'error',
    )
    current = { id: null, element: null }
    delete document.body.dataset.activeApp
    return
  }

  mount(app, appPath)
  document.title = `ELAN — ${app.label}`
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export function startRouter() {
  window.addEventListener('popstate', render)

  // Any link inside the shell chrome navigates without a full page reload.
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[data-shell-link]')
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    navigate(toAppPath(new URL(link.href).pathname))
  })

  // A microfrontend navigating internally: keep the address bar in step, but do
  // not re-render, or we would push the element back to where it already is.
  window.addEventListener('elan:navigate', (event) => {
    const path = event.detail?.path
    if (typeof path !== 'string') return

    const target = resolveApp(path.split('?')[0])
    if (target && target.id !== current.id) {
      navigate(path)
      return
    }

    const url = toBrowserPath(path)
    if (url !== location.pathname + location.search) history.replaceState({}, '', url)
  })

  // Cart's "Continue Shopping". preventDefault() tells it the shell took over.
  window.addEventListener('elan:navigate-catalog', (event) => {
    event.preventDefault()
    const catalog = MICROFRONTENDS.find((app) => app.id === 'catalog')
    navigate(catalog?.home ?? '/')
  })

  render()
}
