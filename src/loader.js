/**
 * Loads a microfrontend's bundle from its LIVE deployment.
 *
 * Three strategies, in order:
 *
 *  1. the stable entry (origin + bundle). This is what the team agreed each app
 *     publishes: one unhashed filename that registers the custom element.
 *
 *  2. any extraEntries the registry lists — a mirror of the same build for an
 *     app whose host is not serving the agreed URL yet.
 *
 *  3. discovery. If none of those work, fetch the app's index.html and pull the
 *     hashed <script type="module"> out of it. Vite renames that file on every
 *     deploy, so this can only ever be a last resort — but it means the shell
 *     still shows something for an app that has not published an element build.
 *
 * Either way the module is imported cross-origin, which every one of the hosts
 * allows (all send Access-Control-Allow-Origin: *).
 */
import { entryCandidates } from './registry.js'
import { ensureIconFont } from './styles.js'

const loads = new Map()

/**
 * A stable, unhashed filename is what makes the shell possible — but it also
 * means the browser caches it, and GitHub Pages / Vercel serve it with a
 * lifetime measured in minutes. A teammate redeploys, the shell keeps running
 * their old bundle, and the integration looks broken for reasons no one can see.
 *
 * So every page load asks for a fresh copy. Computed once, not per call, so all
 * elements in one session agree on a version.
 *
 * Trade-off: no cross-reload caching of ~1MB per microfrontend. For a demo where
 * three people redeploy all day, stale code costs far more than the bandwidth.
 */
const VERSION = `v=${Date.now()}`

function versioned(url) {
  return url.includes('?') ? `${url}&${VERSION}` : `${url}?${VERSION}`
}

async function discoverEntry(origin) {
  const response = await fetch(versioned(`${origin}/`), { mode: 'cors', cache: 'no-store' })
  if (!response.ok) throw new Error(`index.html responded ${response.status}`)

  const html = await response.text()
  const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/i)
  if (!match) throw new Error('no module script found in index.html')

  // Already hashed by Vite, so it needs no cache busting of its own.
  return new URL(match[1], `${origin}/`).href
}

/**
 * A missing file on GitHub Pages returns a 404 page, and on Vercel the SPA
 * rewrite answers with index.html and a 200. Both import "successfully" as a
 * module and silently register nothing, so the content type is the only
 * trustworthy signal that a URL is really the bundle.
 */
async function servesJavaScript(url) {
  try {
    const head = await fetch(url, { method: 'HEAD', mode: 'cors' })
    const type = head.headers.get('content-type') ?? ''
    return head.ok && type.includes('javascript')
  } catch {
    return false
  }
}

async function importFirstThatWorks(app) {
  const candidates = entryCandidates(app)

  for (const [index, candidate] of candidates.entries()) {
    const url = versioned(candidate)
    if (!(await servesJavaScript(url))) continue

    await import(/* @vite-ignore */ url)
    return { url: candidate, strategy: index === 0 ? 'stable' : 'mirror' }
  }

  const discovered = await discoverEntry(app.origin)
  await import(/* @vite-ignore */ discovered)
  return { url: discovered, strategy: 'discovered' }
}

/**
 * Resolves once the app's custom element is registered. Repeated calls for the
 * same app share one load.
 */
export function loadMicrofrontend(app) {
  if (loads.has(app.id)) return loads.get(app.id)

  const load = (async () => {
    ensureIconFont(app)

    if (customElements.get(app.tag)) return { url: 'already-registered', strategy: 'preloaded' }

    const result = await importFirstThatWorks(app)

    // The bundle may register the element asynchronously. Give it a moment
    // rather than declaring failure the instant the import resolves.
    await Promise.race([
      customElements.whenDefined(app.tag),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`<${app.tag}> was never registered by ${result.url}`)),
          8000,
        ),
      ),
    ])

    return result
  })()

  loads.set(app.id, load)
  load.catch(() => loads.delete(app.id)) // let a later retry try again
  return load
}
