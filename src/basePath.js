/**
 * GitHub Pages serves this shell from /fashion-elan-shell/, so the browser's
 * pathname is /fashion-elan-shell/cart while the route table — and every
 * microfrontend — talks in /cart.
 *
 * Everything above this module works in app paths. Only these two functions
 * know about the deployment prefix.
 */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')

/** Browser pathname -> app path. /fashion-elan-shell/cart -> /cart */
export function toAppPath(pathname = location.pathname) {
  if (!BASE) return pathname || '/'
  if (pathname === BASE) return '/'
  return pathname.startsWith(`${BASE}/`) ? pathname.slice(BASE.length) || '/' : pathname
}

/** App path -> browser URL. /cart -> /fashion-elan-shell/cart */
export function toBrowserPath(appPath) {
  const path = appPath.startsWith('/') ? appPath : `/${appPath}`
  return `${BASE}${path}`
}

/** Current app path including query, which is what elements receive. */
export function currentAppPath() {
  return toAppPath(location.pathname) + location.search
}
