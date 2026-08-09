/**
 * Icon fonts, which are the one kind of styling a microfrontend genuinely
 * cannot ship inside its own element.
 *
 * A custom element can carry every rule it needs — Lit puts them in the shadow
 * root, Vue and React inject a <style> tag. An @font-face cannot work that way:
 * the browser resolves fonts against the document, not the shadow tree, so the
 * face has to be declared out here even though the icons are drawn in there.
 *
 * The Account app does ship its font, but as a sidecar stylesheet with the woff2
 * base64-inlined: 17MB raw, 12.8MB over the wire, for a face the browser can
 * fetch from a CDN in about a kilobyte. Loading that file would dominate the
 * page load, so the shell declares the face itself and leaves the sidecar alone.
 * Everything else in that stylesheet is document chrome the shell already owns.
 *
 * The Cart app injects its own MDI link, and the Catalog app draws icons as
 * inline SVG, so neither needs anything here.
 */
const FONT_SOURCES = {
  'material-symbols':
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
}

export function ensureIconFont(app) {
  const href = FONT_SOURCES[app.iconFont]
  if (!href) return

  const id = `elan-font-${app.iconFont}`
  if (document.getElementById(id)) return

  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}
