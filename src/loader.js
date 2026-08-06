/**
 * Loads a microfrontend's bundle from its LIVE deployment.
 *
 * Two strategies, in order:
 *
 *  1. the stable entry (origin + bundle). This is what the team agreed each app
 *     publishes: one unhashed filename that registers the custom element.
 *
 *  2. discovery. If the stable entry 404s, fetch the app's index.html and pull
 *     the hashed <script type="module"> out of it. Vite renames that file on
 *     every deploy, so this can only ever be a fallback — but it means the shell
 *     still works against an app that has not added the stable entry yet.
 *
 * Either way the module is imported cross-origin, which every one of the three
 * hosts allows (all send Access-Control-Allow-Origin: *).
 */

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

async function importFirstThatWorks(app) {
  const stable = versioned(`${app.origin}${app.bundle}`)

  try {
    // A missing file on GitHub Pages / Vercel returns an HTML 404 page, which
    // imports "successfully" as a module and silently registers nothing. Check
    // the content type before trusting it.
    const head = await fetch(stable, { method: 'HEAD', mode: 'cors' })
    const type = head.headers.get('content-type') ?? ''
    if (head.ok && type.includes('javascript')) {
      await import(/* @vite-ignore */ stable)
      return { url: stable, strategy: 'stable' }
    }
  } catch {
    // fall through to discovery
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
