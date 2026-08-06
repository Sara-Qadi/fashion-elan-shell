/**
 * GitHub Pages has no rewrite rules, so a hard refresh on /cart or /account
 * would hit its own 404 page instead of the SPA. Pages does serve `404.html`
 * for any unmatched path, so shipping a copy of index.html under that name
 * hands the URL back to the shell router and every deep link keeps working.
 *
 * Every shell route is virtual — no file exists at /cart — so this matters more
 * here than in any single microfrontend.
 */
import { copyFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

const dist = (name) => fileURLToPath(new URL(`../dist/${name}`, import.meta.url))

await copyFile(dist('index.html'), dist('404.html'))
console.log('spa-fallback: dist/404.html written')
