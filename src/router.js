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
const statusNode = () => document.getElementById('elan-shell-status')

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

/** Where to send the shopper once they have signed in. See startRouter(). */
let pendingReturn = null

/**
 * The last signed-in customer Account announced, kept so it can be replayed.
 *
 * `elan:user-logged-in` is a broadcast: it reaches whoever is listening at the
 * moment it fires, and nobody afterwards. Elements here are mounted lazily, so
 * an app loaded after the sign-in — Cart, if the shopper went straight to
 * Account first — never hears it and behaves as though nobody is signed in.
 * The shell is the only party that sees the whole session, so remembering it
 * and re-announcing to late arrivals is its job.
 */
let lastIdentity = null

/**
 * Marks a replay, so the sign-in round trip does not fire a second time and
 * bounce a shopper who is simply navigating.
 */
function replayIdentity(element) {
  if (!lastIdentity || !element) return

  setTimeout(() => {
    element.dispatchEvent(
      new CustomEvent('elan:user-logged-in', {
        detail: { ...lastIdentity, replayed: true },
        bubbles: true,
        composed: true,
      }),
    )
  }, 0)
}

function setStatus(html, tone = 'info') {
  statusNode().innerHTML = html ? `<div class="elan-shell-status elan-shell-status--${tone}">${html}</div>` : ''
}

function failureMessage(app, error) {
  return `
    <h2>${app.label} is not published as a custom element yet</h2>
    <p>
      The shell asked <code>${app.origin}${app.bundle}</code> for
      <code>&lt;${app.tag}&gt;</code> and could not get it.
    </p>
    <p class="elan-shell-status__detail">${String(error.message ?? error)}</p>
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
 * The same, but never inside the caller's current render pass.
 *
 * A microfrontend can ask to navigate from within its own update cycle —
 * Account's auth guard runs in Lit's `willUpdate` — and the shell answers
 * synchronously. Writing `route` at that moment lands in a window where Lit has
 * already taken its list of changed properties, so the new value is rendered
 * with but never re-read: the element ends up displaying the page it was
 * redirecting *away* from, while `route` says otherwise. A macrotask puts the
 * answer safely after the update has finished.
 */
function setRouteSoon(element, pathname) {
  if (!element) return
  setTimeout(() => setRoute(element, pathname), 0)
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

  // Catch this element up on the session it was not around to hear about.
  replayIdentity(element)

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
    setStatus(`<p class="elan-shell-status__loading">Loading ${app.label}…</p>`, 'loading')
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

    // Only the microfrontend on screen may move the shopper — a hidden app must
    // not navigate the page away from what is actually being looked at.
    //
    // But a hidden app may still move *itself*, and must be allowed to. Account
    // is preloaded so it can hear `elan:order-completed`, and its auth guard
    // asks for /login the moment it loads. Dropping that request left it
    // rendering a signed-out profile page; then, because the shell later showed
    // it at /account — the same value it was preloaded with — its `route` never
    // changed and the guard never ran again. The result was a profile card for
    // "ELAN Customer" sitting under a "You must be signed in" banner.
    const speaker = appBySource(event.detail?.source)
    if (speaker && speaker.id !== current.id) {
      setRouteSoon(mounted.get(speaker.id), path)
      return
    }

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
    if (speaker?.awaitsRouteEcho) setRouteSoon(current.element, path)
  })

  // Cart's "Continue Shopping". preventDefault() tells it the shell took over.
  window.addEventListener('elan:navigate-catalog', (event) => {
    event.preventDefault()
    const catalog = MICROFRONTENDS.find((app) => app.id === 'catalog')
    navigate(catalog?.home ?? '/')
  })

  /*
   * "This shopper needs an account before I can continue."
   *
   * Routing across microfrontends is the shell's job, and so is remembering
   * why: Checkout sends the shopper to Account's sign-in page, and something
   * has to bring them back to the step they were on rather than dumping them on
   * a profile page to find their own way. Neither app can do that alone —
   * Checkout does not own the URL, and Account has never heard of checkout.
   */
  window.addEventListener('elan:sign-in-required', (event) => {
    event.preventDefault()

    const requested = event.detail?.returnTo
    pendingReturn = typeof requested === 'string' && requested.startsWith('/') ? requested : null

    navigate('/login')
  })

  // Account announces a sign-in. If it happened because checkout asked for one,
  // this is the other half of that round trip.
  for (const name of ['elan:user-logged-in', 'elan:user-registered']) {
    window.addEventListener(name, (event) => {
      if (event.detail?.replayed) return

      lastIdentity = event.detail?.user ? { user: event.detail.user } : null

      if (!pendingReturn) return

      const destination = pendingReturn
      pendingReturn = null

      // After the current task, so the signing-in app finishes its own update
      // and its "go to my profile" request lands before this overrides it.
      setTimeout(() => navigate(destination, { replace: true }), 0)
    })
  }

  window.addEventListener('elan:user-logged-out', () => {
    lastIdentity = null
  })

  render()
}
