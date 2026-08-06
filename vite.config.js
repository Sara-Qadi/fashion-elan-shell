import { defineConfig } from 'vite'

/**
 * No framework plugins on purpose — the shell only does integration, and the
 * three microfrontends bring their own runtimes inside their bundles.
 *
 * `base` mirrors the Cart repo: GitHub Pages serves from /<repo>/, and a root
 * deploy can override it with VITE_BASE=/. Keyed on mode rather than command so
 * `vite preview` matches the real build instead of serving subpath assets from
 * the root.
 */
const GITHUB_PAGES_BASE = '/fashion-elan-shell/'

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? (mode === 'production' ? GITHUB_PAGES_BASE : '/'),
  server: {
    port: 5180,
  },
}))
