/**
 * The Shell owns the browser URL.
 *
 * Microfrontends receive their current route through a
 * `route` property.
 *
 * Microfrontends request navigation using:
 *
 * elan:navigate
 *
 * The Shell then:
 *
 * 1. prevents the microfrontend from owning browser history
 * 2. updates browser history
 * 3. updates the mounted element's route property
 * 4. mounts another microfrontend only when navigation
 *    crosses application boundaries
 */

import {
  currentAppPath,
  toAppPath,
  toBrowserPath,
} from './basePath.js';

import {
  loadMicrofrontend,
} from './loader.js';

import {
  MICROFRONTENDS,
  resolveApp,
} from './registry.js';

const outlet = () =>
  document.getElementById(
    'elan-outlet',
  );

let current = {
  id: null,
  element: null,
};

function setStatus(
  html,
  tone = 'info',
) {
  const node = outlet();

  node.innerHTML = `
    <div
      class="elan-status elan-status--${tone}"
    >
      ${html}
    </div>
  `;
}

function failureMessage(
  app,
  error,
) {
  return `
    <h2>
      ${app.label} is not published as a custom element yet
    </h2>

    <p>
      The shell asked
      <code>
        ${app.origin}${app.bundle}
      </code>
      for
      <code>
        &lt;${app.tag}&gt;
      </code>
      and could not get it.
    </p>

    <p class="elan-status__detail">
      ${String(
        error.message ?? error,
      )}
    </p>

    <p>
      This is expected until
      ${app.owner}
      publishes the element build.
      The other microfrontends keep
      working in the meantime.
    </p>

    <p>
      <a
        href="${app.origin}"
        target="_blank"
        rel="noreferrer"
      >
        Open ${app.label} standalone
      </a>
    </p>
  `;
}

/**
 * Update the route of the currently mounted
 * microfrontend without tearing it down.
 */
function updateMountedRoute(
  pathname,
) {
  if (!current.element) {
    return;
  }

  /*
   * Set both the property and attribute.
   *
   * Lit/Vue/React Web Component wrappers may react to
   * either mechanism.
   */
  current.element.route =
    pathname;

  current.element.setAttribute(
    'route',
    pathname,
  );
}

/**
 * Mounting is per application, not per route.
 *
 * Moving from:
 *
 * /orders
 *      ->
 * /orders/123
 *
 * must not recreate Account.
 */
async function mount(
  app,
  pathname,
) {
  if (
    current.id === app.id &&
    current.element
  ) {
    updateMountedRoute(
      pathname,
    );

    return;
  }

  setStatus(
    `<p class="elan-status__loading">
      Loading ${app.label}…
    </p>`,
    'loading',
  );

  try {
    await loadMicrofrontend(
      app,
    );
  } catch (error) {
    setStatus(
      failureMessage(
        app,
        error,
      ),
      'error',
    );

    current = {
      id: null,
      element: null,
    };

    return;
  }

  const element =
    document.createElement(
      app.tag,
    );

  element.route =
    pathname;

  element.setAttribute(
    'route',
    pathname,
  );

  element.dataset.elanApp =
    app.id;

  const node = outlet();

  node.innerHTML = '';

  node.appendChild(
    element,
  );

  current = {
    id: app.id,
    element,
  };

  document.body.dataset.activeApp =
    app.id;
}

/**
 * Takes an APP path:
 *
 * /cart
 * /orders
 * /profile
 *
 * Not the GitHub Pages browser prefix.
 */
export function navigate(
  appPath,
  {
    replace = false,
  } = {},
) {
  const url =
    toBrowserPath(
      appPath,
    );

  const currentUrl =
    location.pathname +
    location.search;

  if (
    url !== currentUrl
  ) {
    if (replace) {
      history.replaceState(
        {},
        '',
        url,
      );
    } else {
      history.pushState(
        {},
        '',
        url,
      );
    }
  }

  render();
}

export function render() {
  const appPath =
    currentAppPath();

  const app =
    resolveApp(
      toAppPath(),
    );

  if (!app) {
    setStatus(
      `
        <h2>404</h2>

        <p>
          No microfrontend owns
          <code>
            ${escapeHtml(
              appPath,
            )}
          </code>.
        </p>

        <p>
          <a
            href="${toBrowserPath(
              '/',
            )}"
            data-shell-link
          >
            Back to the shop
          </a>
        </p>
      `,
      'error',
    );

    current = {
      id: null,
      element: null,
    };

    delete document.body
      .dataset.activeApp;

    return;
  }

  mount(
    app,
    appPath,
  );

  document.title =
    `ELAN — ${app.label}`;
}

function escapeHtml(
  value,
) {
  return String(
    value,
  ).replace(
    /[&<>"']/g,
    (character) =>
      `&#${character.charCodeAt(
        0,
      )};`,
  );
}

export function startRouter() {
  window.addEventListener(
    'popstate',
    render,
  );

  /**
   * Links belonging to the Shell chrome.
   */
  document.addEventListener(
    'click',
    (event) => {
      const link =
        event.target.closest?.(
          'a[data-shell-link]',
        );

      if (
        !link ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }

      event.preventDefault();

      navigate(
        toAppPath(
          new URL(
            link.href,
          ).pathname,
        ),
      );
    },
  );

  /**
   * Navigation requested by a microfrontend.
   */
  window.addEventListener(
    'elan:navigate',
    (event) => {
      const path =
        event.detail?.path;

      if (
        typeof path !==
          'string' ||
        !path.trim()
      ) {
        return;
      }

      /*
       * CRITICAL:
       *
       * Tell the microfrontend that the Shell has taken
       * ownership of navigation.
       *
       * Account's requestNavigation() checks this.
       */
      if (event.cancelable) {
        event.preventDefault();
      }

      const replace =
        event.detail
          ?.replace === true;

      const cleanPath =
        path.split('?')[0];

      const target =
        resolveApp(
          cleanPath,
        );

      /*
       * Navigation crosses MFE boundaries.
       *
       * Example:
       *
       * Account -> Cart
       */
      if (
        target &&
        target.id !==
          current.id
      ) {
        navigate(
          path,
          {
            replace,
          },
        );

        return;
      }

      /*
       * Same MFE.
       *
       * Do NOT tear down the component.
       *
       * Update browser URL and then tell the existing
       * component its new route.
       */
      const url =
        toBrowserPath(
          path,
        );

      const currentUrl =
        location.pathname +
        location.search;

      if (
        url !== currentUrl
      ) {
        if (replace) {
          history.replaceState(
            {},
            '',
            url,
          );
        } else {
          history.pushState(
            {},
            '',
            url,
          );
        }
      }

      updateMountedRoute(
        path,
      );
    },
  );

  /**
   * Temporary Cart event.
   *
   * Eventually Cart should use elan:navigate directly.
   */
  window.addEventListener(
    'elan:navigate-catalog',
    (event) => {
      event.preventDefault();

      const catalog =
        MICROFRONTENDS.find(
          (app) =>
            app.id ===
            'catalog',
        );

      navigate(
        catalog?.home ??
          '/',
      );
    },
  );

  render();
}