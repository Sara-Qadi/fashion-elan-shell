/**
 * ELAN shell — integration only.
 *
 * It owns four things and nothing else:
 *   the URL, the shared header, the event bus, and which microfrontend is on
 *   screen. No product data, no cart logic, no account state. Those live in the
 *   three member apps and are loaded from their live deployments at runtime.
 */
import { startBus } from './bus.js'
import { mountChrome, syncNav } from './chrome.js'
import { startEnrichment } from './enrich.js'
import { startRouter } from './router.js'
import './styles.css'

// Before anything mounts, so it sees an add-to-cart ahead of the Cart element.
startEnrichment()
startBus()
mountChrome()
startRouter()
syncNav()

// The router writes the active app and the current path onto the body; mirror
// both into the nav, so the header highlights the right app and, inside
// Catalog, the category actually being browsed.
new MutationObserver(syncNav).observe(document.body, {
  attributes: true,
  attributeFilter: ['data-active-app', 'data-app-path'],
})
