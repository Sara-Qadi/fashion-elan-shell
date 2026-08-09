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
import { appBySource, MICROFRONTENDS, resolveApp } from './registry.js'

const outlet = () => document.getElementById('elan-outlet')
const statusNode = () => document.getElementById('elan-status')

/**
 * Mounted elements, by app id. Nothing is ever removed from here.
 *
 * A microfrontend that owns shared state cannot be torn down when the shopper
 * navigates away from it. The bag is the clear case: Catalog announces a chosen
 * product with `elan:add-to-cart`, and only the Cart element knows what to do
 * with that — so if it is not on the page while the shopper is browsing, every
 * add silently disappears. Keeping each element mounted and merely hidden also
 * means a half-filled checkout form survives a trip back to the catalog.
 */
const mounted = new Map()

let current = { id: null, element: null }

function setStatus(html, tone = 'info') {
  statusNode().innerHTML = html ? `<div class="elan-status elan-status--${tone}">${html}</div>` : ''
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
 * Tells an element where it is.
 *
 * Both the property and the attribute, because the three wrappers do not agree
 * on which one they observe: Lit reflects the property, and a React element
 * built with r2wc may only see the attribute.
 */
function setRoute(element, pathname) {
  if (!element) return
  element.route = pathname
  element.setAttribute('route', pathname)
}

/**
 * Loads an app and puts its element in the outlet, hidden. Safe to call again;
 * the second call returns the element already there.
 */
async function ensureMounted(app, route) {
  const existing = mounted.get(app.id)
  if (existing) return existing

  await loadMicrofrontend(app)

  const element = document.createElement(app.tag)
  element.dataset.elanApp = app.id
  element.hidden = true

  // Set before it is connected, and set to where the element is actually
  // wanted. Two reasons it must never be left empty or approximate:
  //
  //  - An element with no route cannot tell it is embedded. The Account app
  //    decides from exactly that, and unset it treats itself as the whole page
  //    and lets its auth guard rewrite the address bar out from under us.
  //  - Mounting at the app's home and correcting afterwards makes the element
  //    navigate twice, and it reports both hops back as `elan:navigate` — so a
  //    reload of /checkout/payment briefly claimed to be at /cart and the
  //    address bar kept the wrong one.
  setRoute(element, route ?? app.home)

  outlet().appendChild(element)
  mounted.set(app.id, element)
  return element
}

/**
 * Switching from /cart to /checkout/shipping must not tear the element down, or
 * the shopper would lose everything they typed — so navigation only ever
 * changes which element is visible and what `route` the active one is given.
 */
async function mount(app, pathname) {
  if (current.id === app.id && current.element) {
    setRoute(current.element, pathname)
    return
  }

  if (!mounted.has(app.id)) {
    setStatus(`<p class="elan-status__loading">Loading ${app.label}…</p>`, 'loading')
  }

  let element
  try {
    element = await ensureMounted(app, pathname)
  } catch (error) {
    setStatus(failureMessage(app, error), 'error')
    current = { id: null, element: null }
    return
  }

  // Another navigation may have resolved first while this one was loading.
  if (resolveApp(toAppPath()) !== app) return

  setStatus('')

  // Claim active status first. The route change below makes the element route
  // internally and report back with `elan:navigate`, and the handler for that
  // ignores anything from an app that is not current — so if this ran after,
  // the active app's very first navigation would be discarded as background
  // chatter and the address bar would keep the previous route.
  current = { id: app.id, element }
  document.body.dataset.activeApp = app.id

  // The route goes on before it is shown, so the element never paints the page
  // it was last looking at.
  setRoute(element, pathname)
  for (const [id, node] of mounted) node.hidden = id !== app.id

  // Elements are hidden rather than destroyed, so the document keeps whatever
  // scroll offset the previous app left behind — arriving at the bag halfway
  // down the page. 'instant' because Vuetify's reset turns on smooth scrolling
  // document-wide, and animating this reads as a glitch rather than a move.
  window.scrollTo({ top: 0, behavior: 'instant' })
}

/**
 * Brings up the microfrontends that need to be listening even when they are not
 * on screen, once the app the shopper actually asked for is up.
 *
 * Cart must hear `elan:add-to-cart` from the Catalog page, and Account must
 * hear `elan:order-completed` to file the order in its history — neither of
 * which happens on a route those apps own. Failures are ignored: this is a
 * background nicety, and the visible app already reported anything real.
 */
export function preloadBackgroundApps() {
  for (const app of MICROFRONTENDS) {
    if (!app.listensWhileHidden || mounted.has(app.id)) continue
    ensureMounted(app).catch(() => {})
  }
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

  // Mirrored onto the body so the chrome can react to a route change without
  // the header having to import the router and the router the header.
  document.body.dataset.appPath = appPath

  if (!app) {
    for (const node of mounted.values()) node.hidden = true
    setStatus(
      `<h2>404</h2><p>No microfrontend owns <code>${escapeHtml(appPath)}</code>.</p>
       <p><a href="${toBrowserPath('/')}" data-shell-link>Back to the shop</a></p>`,
      'error',
    )
    current = { id: null, element: null }
    delete document.body.dataset.activeApp
    return
  }

  mount(app, appPath).then(preloadBackgroundApps)
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
    if (typeof path !== 'string' || !path.trim()) return

    // Only the microfrontend on screen may move the shopper. The others are
    // still mounted and still routing internally — Account's auth guard asks
    // for /login the moment it loads — and a hidden app must not be able to
    // navigate the page away from whatever the shopper is actually looking at.
    const speaker = appBySource(event.detail?.source)
    if (speaker && speaker.id !== current.id) return

    // How an app is told the shell took ownership of navigation. Account's
    // requestNavigation() checks this before touching history itself.
    if (event.cancelable) event.preventDefault()

    const replace = event.detail?.replace === true

    const target = resolveApp(path.split('?')[0])
    if (target && target.id !== current.id) {
      navigate(path, { replace })
      return
    }

    const url = toBrowserPath(path)
    if (url !== location.pathname + location.search) {
      if (replace) history.replaceState({}, '', url)
      else history.pushState({}, '', url)
    }

    // Some apps ask the shell to navigate and then wait to be told where they
    // are; others move themselves and report afterwards. Only the first kind
    // may be echoed back to.
    //
    // Echoing at the wrong app is not harmless. The Cart element has already
    // navigated by the time it reports, so setting `route` again starts a
    // second navigation that cancels the first — and Vue Router leaves
    // <router-view> empty when its in-flight navigation is superseded. That is
    // what a deep link to /checkout/shipping with no shipping data on file
    // rendered: a correct URL, a mounted app, and a blank page.
    if (speaker?.awaitsRouteEcho) setRoute(current.element, path)
  })

  // Cart's "Continue Shopping". preventDefault() tells it the shell took over.
  window.addEventListener('elan:navigate-catalog', (event) => {
    event.preventDefault()
    const catalog = MICROFRONTENDS.find((app) => app.id === 'catalog')
    navigate(catalog?.home ?? '/')
  })

  render()
}
