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
 * navigates away from it.
 */
const mounted = new Map()

let current = {
  id: null,
  element: null,
}

/** Where to send the shopper once they have signed in. */
let pendingReturn = null

/**
 * The last signed-in customer Account announced, kept so it can be replayed
 * to microfrontends that mount later.
 */
let lastIdentity = null

/**
 * Replay the current signed-in identity to a late-mounted app.
 */
function replayIdentity(element) {
  if (!lastIdentity || !element) return

  setTimeout(() => {
    element.dispatchEvent(
      new CustomEvent('elan:user-logged-in', {
        detail: {
          ...lastIdentity,
          replayed: true,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }, 0)
}

function setStatus(html, tone = 'info') {
  statusNode().innerHTML = html
    ? `<div class="elan-shell-status elan-shell-status--${tone}">${html}</div>`
    : ''
}

function failureMessage(app, error) {
  return `
    <h2>${app.label} is not published as a custom element yet</h2>

    <p>
      The shell asked
      <code>${app.origin}${app.bundle}</code>
      for
      <code>&lt;${app.tag}&gt;</code>
      and could not get it.
    </p>

    <p class="elan-shell-status__detail">
      ${String(error.message ?? error)}
    </p>

    <p>
      This is expected until ${app.owner} publishes the element build.
      The instructions are in <code>docs/</code> of the shell repo,
      and the other microfrontends keep working in the meantime.
    </p>

    <p>
      <a
        href="${app.origin}"
        target="_blank"
        rel="noreferrer"
      >
        Open ${app.label} standalone
      </a>
    </p>
  `
}

/**
 * Tells a microfrontend where it currently is.
 *
 * We write both the property and the attribute because different wrappers
 * observe routes differently.
 */
function setRoute(element, pathname) {
  if (!element) return

  element.route = pathname
  element.setAttribute('route', pathname)
}

/**
 * Same as setRoute(), but after the current update cycle.
 *
 * This is especially important for the Lit-based Account MFE because it may
 * request navigation while it is already updating.
 */
function setRouteSoon(element, pathname) {
  if (!element) return

  setTimeout(() => {
    setRoute(element, pathname)
  }, 0)
}

/**
 * Tell the shared chrome that the application route changed.
 *
 * chrome.js listens to this so Wishlist / Account / Cart active states update
 * immediately without requiring a browser refresh.
 */
function announceShellRoute(appPath) {
  window.dispatchEvent(
    new CustomEvent('elan:shell-route-changed', {
      detail: {
        path: appPath,
        activeApp: document.body.dataset.activeApp ?? null,
      },
    }),
  )
}

/**
 * Loads an app and puts its element in the outlet, hidden.
 *
 * Safe to call repeatedly; already mounted apps are returned directly.
 */
async function ensureMounted(app, route) {
  const existing = mounted.get(app.id)

  if (existing) {
    return existing
  }

  await loadMicrofrontend(app)

  const element = document.createElement(app.tag)

  element.dataset.elanApp = app.id
  element.hidden = true

  /**
   * Set the route before connection.
   *
   * This is important because Account uses the presence of its route to know
   * that it is embedded inside the shell.
   */
  setRoute(element, route ?? app.home)

  outlet().appendChild(element)

  mounted.set(app.id, element)

  replayIdentity(element)

  return element
}

/**
 * Show one mounted microfrontend while leaving the others alive but hidden.
 */
async function mount(app, pathname) {
  /**
   * Navigating inside the SAME MFE.
   *
   * Example:
   * /account/profile
   * -> /account/orders
   * -> /account/wishlist
   *
   * We must update the element's route even though we don't remount it.
   */
  if (current.id === app.id && current.element) {
    setRoute(current.element, pathname)

    document.body.dataset.activeApp = app.id
    document.body.dataset.appPath = pathname

    announceShellRoute(pathname)

    return
  }

  if (!mounted.has(app.id)) {
    setStatus(
      `<p class="elan-shell-status__loading">
        Loading ${app.label}…
      </p>`,
      'loading',
    )
  }

  let element

  try {
    element = await ensureMounted(app, pathname)
  } catch (error) {
    setStatus(failureMessage(app, error), 'error')

    current = {
      id: null,
      element: null,
    }

    return
  }

  /**
   * Another navigation may have completed while this app was loading.
   */
  if (resolveApp(toAppPath()) !== app) {
    return
  }

  setStatus('')

  /**
   * Mark the app active BEFORE setting its route.
   */
  current = {
    id: app.id,
    element,
  }

  document.body.dataset.activeApp = app.id
  document.body.dataset.appPath = pathname

  setRoute(element, pathname)

  for (const [id, node] of mounted) {
    node.hidden = id !== app.id
  }

  announceShellRoute(pathname)

  window.scrollTo({
    top: 0,
    behavior: 'instant',
  })
}

/**
 * Mount apps that need to listen to global events even while hidden.
 *
 * Example:
 * - Cart listens for elan:add-to-cart
 * - Account listens for elan:order-completed
 */
export function preloadBackgroundApps() {
  for (const app of MICROFRONTENDS) {
    if (!app.listensWhileHidden || mounted.has(app.id)) {
      continue
    }

    ensureMounted(app).catch(() => {})
  }
}

/**
 * Takes an APP path such as:
 *
 * /cart
 * /wishlist
 * /account/orders
 *
 * rather than the GitHub Pages browser-prefixed path.
 */
export function navigate(appPath, { replace = false } = {}) {
  const url = toBrowserPath(appPath)

  /**
   * Even if the browser URL is already correct, render again.
   *
   * This protects us from the case where the address bar changed but the
   * currently mounted MFE did not yet receive its route.
   */
  if (url === location.pathname + location.search) {
    render()
    return
  }

  if (replace) {
    history.replaceState({}, '', url)
  } else {
    history.pushState({}, '', url)
  }

  render()
}

export function render() {
  const appPath = currentAppPath()
  const app = resolveApp(toAppPath())

  /**
   * Shared chrome reads this to know the exact current route.
   */
  document.body.dataset.appPath = appPath

  if (!app) {
    for (const node of mounted.values()) {
      node.hidden = true
    }

    setStatus(
      `
        <h2>404</h2>

        <p>
          No microfrontend owns
          <code>${escapeHtml(appPath)}</code>.
        </p>

        <p>
          <a
            href="${toBrowserPath('/')}"
            data-shell-link
          >
            Back to the shop
          </a>
        </p>
      `,
      'error',
    )

    current = {
      id: null,
      element: null,
    }

    delete document.body.dataset.activeApp

    announceShellRoute(appPath)

    return
  }

  mount(app, appPath).then(preloadBackgroundApps)

  document.title = `ELAN — ${app.label}`
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) => `&#${character.charCodeAt(0)};`,
  )
}

export function startRouter() {
  /**
   * Browser Back / Forward.
   */
  window.addEventListener('popstate', () => {
    render()
  })

  /**
   * Any link in the shared shell header/footer navigates without a page reload.
   */
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[data-shell-link]')

    if (!link) return

    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()

    const browserUrl = new URL(link.href)

    const appPath =
      toAppPath(browserUrl.pathname) +
      browserUrl.search

    navigate(appPath)
  })

  /**
   * Navigation requested by one of the microfrontends.
   */
  window.addEventListener('elan:navigate', (event) => {
    const path = event.detail?.path

    if (typeof path !== 'string' || !path.trim()) {
      return
    }

    /**
     * Try to identify which registered MFE emitted the event.
     */
    const speaker = appBySource(event.detail?.source)

    /**
     * A hidden microfrontend may update ITSELF, but it must not move the browser
     * away from the application the shopper is currently viewing.
     */
    if (speaker && speaker.id !== current.id) {
      setRouteSoon(
        mounted.get(speaker.id),
        path,
      )

      return
    }

    /**
     * Tell the MFE that the shell accepted ownership of browser navigation.
     */
    if (event.cancelable) {
      event.preventDefault()
    }

    const replace = event.detail?.replace === true

    /**
     * Resolve the app owning the requested route.
     */
    const cleanPath = path.split('?')[0]
    const target = resolveApp(cleanPath)

    /**
     * Cross-MFE navigation.
     *
     * Example:
     * Catalog -> Cart
     * Cart -> Account
     */
    if (target && target.id !== current.id) {
      navigate(path, {
        replace,
      })

      return
    }

    /**
     * Same-MFE navigation.
     *
     * Update the actual browser URL.
     */
    const url = toBrowserPath(path)

    if (url !== location.pathname + location.search) {
      if (replace) {
        history.replaceState({}, '', url)
      } else {
        history.pushState({}, '', url)
      }
    }

    /**
     * Keep the shell's route mirror up to date immediately.
     */
    document.body.dataset.appPath = path

    /**
     * IMPORTANT ACCOUNT FIX
     * ---------------------
     *
     * Previously the route was echoed only when:
     *
     *     speaker?.awaitsRouteEcho
     *
     * If Account's elan:navigate event reached the shell without a source that
     * appBySource() could identify, the browser URL changed but the Account
     * element never received its new `route`.
     *
     * Result:
     *
     * URL: /account/orders
     * Screen: still Profile
     *
     * Refresh:
     * Orders suddenly appears.
     *
     * We now safely fall back to the CURRENT app's registry configuration.
     *
     * This does NOT create the Cart double-navigation problem because Cart has
     * awaitsRouteEcho: false.
     */
    const currentAppConfig =
      MICROFRONTENDS.find((app) => app.id === current.id) ?? null

    const shouldEcho =
      speaker?.awaitsRouteEcho === true ||
      (
        !speaker &&
        target?.id === current.id &&
        currentAppConfig?.awaitsRouteEcho === true
      )

    if (shouldEcho && current.element) {
      setRouteSoon(
        current.element,
        path,
      )
    }

    /**
     * Update Wishlist / Account / Bag active states immediately.
     */
    announceShellRoute(path)
  })

  /**
   * Cart's Continue Shopping event.
   */
  window.addEventListener('elan:navigate-catalog', (event) => {
    event.preventDefault()

    const catalog = MICROFRONTENDS.find(
      (app) => app.id === 'catalog',
    )

    navigate(
      catalog?.home ?? '/',
    )
  })

  /**
   * Checkout requires authentication.
   */
  window.addEventListener('elan:sign-in-required', (event) => {
    event.preventDefault()

    const requested = event.detail?.returnTo

    pendingReturn =
      typeof requested === 'string' &&
      requested.startsWith('/')
        ? requested
        : null

    navigate('/login')
  })

  /**
   * Account announces successful login / registration.
   *
   * If login happened because Checkout requested it, send the shopper back
   * to the pending checkout route.
   */
  for (const name of [
    'elan:user-logged-in',
    'elan:user-registered',
  ]) {
    window.addEventListener(name, (event) => {
      if (event.detail?.replayed) {
        return
      }

      lastIdentity = event.detail?.user
        ? {
            user: event.detail.user,
          }
        : null

      if (!pendingReturn) {
        return
      }

      const destination = pendingReturn

      pendingReturn = null

      setTimeout(() => {
        navigate(destination, {
          replace: true,
        })
      }, 0)
    })
  }

  window.addEventListener(
    'elan:user-logged-out',
    () => {
      lastIdentity = null
    },
  )

  render()
}