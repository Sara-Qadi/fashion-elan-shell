/**
 * A shim, and marked as one.
 *
 * The Catalog app has `product.images[]` but does not put any of it in
 * `elan:add-to-cart`. The Cart app therefore shows its letter-tile placeholder
 * for anything added from a product page, and so does the order history built
 * from it — everything works, it just looks broken.
 *
 * The proper fix is one field in her payload, and it is the first item on the
 * "nice to have" list in docs/PROMPT-catalog-react.md. Until then the shell
 * fills the gap from what is already on screen: add-to-cart is only reachable
 * from the product detail page, which is showing that product's own photograph
 * at the moment the event fires.
 *
 * Deliberately narrow, so it cannot cause a wrong picture rather than none:
 *   - only for events from Catalog, and only when imageUrl is genuinely absent
 *   - only the largest visible image inside the Catalog element, which on a
 *     product page is the gallery hero and not a thumbnail or a related product
 *   - never throws, and silently does nothing if it finds nothing
 *
 * Delete this file when the payload carries an image.
 */
import { getApp } from './registry.js'

/** Below this, it is a thumbnail or an icon rather than the product shot. */
const MIN_HERO_AREA = 40000 // ~200x200

function heroImage(root) {
  let best = null
  let bestArea = MIN_HERO_AREA

  for (const img of root.querySelectorAll('img')) {
    if (!img.currentSrc && !img.src) continue

    const { width, height } = img.getBoundingClientRect()
    const area = width * height
    if (area > bestArea) {
      best = img
      bestArea = area
    }
  }

  return best?.currentSrc || best?.src || null
}

export function startEnrichment() {
  window.addEventListener('elan:add-to-cart', (event) => {
    const detail = event.detail
    if (!detail || detail.source !== 'elan-catalog') return
    if (detail.imageUrl || detail.image) return

    try {
      const element = document.querySelector(getApp('catalog').tag)
      const src = element && heroImage(element)
      if (src) detail.imageUrl = src
    } catch {
      // The bag is still correct without a picture.
    }
  })
}
