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
import { startRouter } from './router.js'
import './styles.css'

startBus()
mountChrome()
startRouter()
syncNav()

// The router swaps document.body.dataset.activeApp; mirror it into the nav.
new MutationObserver(syncNav).observe(document.body, {
  attributes: true,
  attributeFilter: ['data-active-app'],
})
