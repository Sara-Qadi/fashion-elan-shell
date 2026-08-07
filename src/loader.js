/**
 * Loads a microfrontend's bundle from its LIVE deployment.
 *
 * Loading strategy:
 *
 * 1. Load optional stylesheet
 * 2. Try the stable entry
 * 3. Fall back to Vite index.html discovery
 * 4. Wait until the custom element is registered
 */

const loads =
  new Map();

const loadedStyles =
  new Map();

/**
 * Cache-bust every shell page load.
 */
const VERSION =
  `v=${Date.now()}`;

function versioned(url) {
  return url.includes('?')
    ? `${url}&${VERSION}`
    : `${url}?${VERSION}`;
}

function createStylesheetId(app) {
  return `elan-mfe-style-${app.id}`;
}

async function loadStylesheet(
  app,
) {
  if (!app.styles) {
    return;
  }

  if (
    loadedStyles.has(app.id)
  ) {
    return loadedStyles.get(
      app.id,
    );
  }

  const load =
    new Promise(
      (resolve, reject) => {
        const existing =
          document.getElementById(
            createStylesheetId(
              app,
            ),
          );

        if (existing) {
          resolve();

          return;
        }

        const link =
          document.createElement(
            'link',
          );

        link.id =
          createStylesheetId(
            app,
          );

        link.rel =
          'stylesheet';

        link.href =
          versioned(
            `${app.origin}${app.styles}`,
          );

        link.crossOrigin =
          'anonymous';

        link.addEventListener(
          'load',
          () => resolve(),
          {
            once: true,
          },
        );

        link.addEventListener(
          'error',
          () => {
            link.remove();

            reject(
              new Error(
                `Unable to load stylesheet ${link.href}`,
              ),
            );
          },
          {
            once: true,
          },
        );

        document.head.appendChild(
          link,
        );
      },
    );

  loadedStyles.set(
    app.id,
    load,
  );

  try {
    await load;
  } catch (error) {
    loadedStyles.delete(
      app.id,
    );

    throw error;
  }
}

async function discoverEntry(
  origin,
) {
  const response =
    await fetch(
      versioned(
        `${origin}/`,
      ),
      {
        mode: 'cors',
        cache: 'no-store',
      },
    );

  if (!response.ok) {
    throw new Error(
      `index.html responded ${response.status}`,
    );
  }

  const html =
    await response.text();

  const match =
    html.match(
      /<script[^>]+type="module"[^>]+src="([^"]+)"/i,
    );

  if (!match) {
    throw new Error(
      'no module script found in index.html',
    );
  }

  return new URL(
    match[1],
    `${origin}/`,
  ).href;
}

async function importFirstThatWorks(
  app,
) {
  const stable =
    versioned(
      `${app.origin}${app.bundle}`,
    );

  try {
    const head =
      await fetch(
        stable,
        {
          method: 'HEAD',
          mode: 'cors',
        },
      );

    const type =
      head.headers.get(
        'content-type',
      ) ?? '';

    if (
      head.ok &&
      type.includes(
        'javascript',
      )
    ) {
      await import(
        /* @vite-ignore */
        stable
      );

      return {
        url: stable,
        strategy:
          'stable',
      };
    }
  } catch {
    // Fall through to discovery.
  }

  const discovered =
    await discoverEntry(
      app.origin,
    );

  await import(
    /* @vite-ignore */
    discovered
  );

  return {
    url: discovered,
    strategy:
      'discovered',
  };
}

/**
 * Resolves once the application's custom element
 * is registered.
 */
export function loadMicrofrontend(
  app,
) {
  if (
    loads.has(app.id)
  ) {
    return loads.get(
      app.id,
    );
  }

  const load =
    (async () => {
      /*
       * Load global MFE styles first.
       *
       * Account uses this for Material Symbols and
       * other global assets that cannot live only
       * inside component shadow roots.
       */
      await loadStylesheet(
        app,
      );

      if (
        customElements.get(
          app.tag,
        )
      ) {
        return {
          url:
            'already-registered',

          strategy:
            'preloaded',
        };
      }

      const result =
        await importFirstThatWorks(
          app,
        );

      await Promise.race([
        customElements.whenDefined(
          app.tag,
        ),

        new Promise(
          (
            _,
            reject,
          ) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `<${app.tag}> was never registered by ${result.url}`,
                  ),
                ),
              8000,
            ),
        ),
      ]);

      return result;
    })();

  loads.set(
    app.id,
    load,
  );

  load.catch(() => {
    loads.delete(
      app.id,
    );
  });

  return load;
}