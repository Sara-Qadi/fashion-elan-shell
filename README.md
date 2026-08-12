# ELAN — Shell Application

Integration-only shell for the **ELAN Fashion & Apparel Marketplace (Group 1)**.

The project integrates three independently developed and deployed microfrontends into one unified storefront experience using **Web Components** and **Browser Custom Events**.

The Shell is responsible only for integration, routing, shared UI, and communication between the microfrontends. It does not contain the business logic of Catalog, Cart, or Account.

## Live Shell

https://sara-qadi.github.io/fashion-elan-shell/

## The three microfrontends

| Part | Owner | Framework | Element | Live | Repo |
|---|---|---|---|---|---|
| Catalog & Discovery | Maha Hussam | React + MUI | `<elan-catalog-app>` | [live](https://fashion-elan-category-discovery.vercel.app/) | [repo](https://github.com/Maha-hussam/fashion_elan_category_discovery) |
| Cart & Checkout | Sara Qadi | Vue 3 + Vuetify | `<elan-cart-app>` | [live](https://sara-qadi.github.io/fashion-elan-card-checkout/) | [repo](https://github.com/Sara-Qadi/fashion-elan-card-checkout) |
| Account & Orders | Mais Arman | Lit + Material Web | `<elan-account-app>` | [live](https://fashion-elan-account-orders.vercel.app/) | [repo](https://github.com/mais-arman/fashion-elan-account-orders) |

Each microfrontend is maintained in its own repository and deployed independently.

The Shell contains **no copy of the source code** of the three applications. Their deployed Web Component bundles are loaded at runtime.

---

# What the Shell Does

The Shell acts as the integration layer of the ELAN application.

Its responsibilities include:

- Loading the three independently deployed microfrontends.
- Determining which microfrontend owns the current route.
- Managing the browser URL and navigation.
- Synchronizing routes with the mounted Web Components.
- Keeping required microfrontends mounted so they can continue listening for cross-app events.
- Providing one shared ELAN header and footer.
- Providing shared category navigation.
- Providing the shared search entry point.
- Displaying and synchronizing the shopping bag count.
- Providing an Event Bus Inspector for demonstrating communication between the applications.
- Coordinating communication using Browser `CustomEvent`s.

The Shell contains **integration logic only**. Business logic remains inside the individual microfrontends.

---

# Integration Method

The ELAN project uses:

**Web Components + Browser Custom Events + Integration Shell**

## Why We Chose This Method

The three microfrontends use different frameworks:

- **Catalog & Discovery:** React
- **Cart & Checkout:** Vue
- **Account & Orders:** Lit

Because the applications use different frameworks, we needed a framework-independent integration method.

**Web Components** provide a common browser-native boundary that allows React, Vue, and Lit applications to be loaded inside the same Shell.

The Shell does not need to understand the internal implementation of each framework. It only needs to know:

1. The deployed bundle URL.
2. The custom element tag.
3. The routes owned by the microfrontend.
4. The events used for communication.

**Browser Custom Events** are used for communication because they allow the microfrontends to exchange information without importing code from one another or depending on a shared framework-specific store.

This keeps the microfrontends **independently developed, independently deployed, and loosely coupled**.

---

# Routing Strategy

One of the main architectural rules of ELAN is:

> **The Shell owns the browser URL.**

The three microfrontends do not independently control browser history while embedded inside the Shell.

When a microfrontend wants to navigate, it emits:

```text
elan:navigate
```

Example payload:

```json
{
  "path": "/account/orders",
  "replace": false
}
```

The Shell receives the event, updates the browser URL, determines which microfrontend owns the destination, and synchronizes the route with the appropriate Web Component.

This prevents the React, Vue, and Lit applications from competing over browser `history` and `popstate`.

---

# Source Map

| File | Responsibility |
|---|---|
| `src/registry.js` | Defines the three microfrontends, their deployed bundle information, custom element tags, owned routes, and integration behavior |
| `src/loader.js` | Loads the deployed Web Component bundles |
| `src/router.js` | Owns browser history, determines the active microfrontend, and synchronizes routes |
| `src/bus.js` | Observes and coordinates `elan:*` Browser Custom Events |
| `src/chrome.js` | Provides the shared header, category navigation, search, bag badge, footer, and Event Inspector |
| `src/styles.js` | Handles document-level icon font requirements |
| `src/basePath.js` | Converts between GitHub Pages browser paths and internal application routes |

---

# Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Local development URL:

```text
http://localhost:5180
```

The Shell loads the deployed microfrontend bundles, so the three member applications do not all need to be running locally.

---

# Production Build

Build the Shell:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

# Deployment

The ELAN Integration Shell is deployed using **GitHub Pages**.

Live URL:

https://sara-qadi.github.io/fashion-elan-shell/

GitHub Actions publishes the Shell through the configured deployment workflow.

Because GitHub Pages serves the application from:

```text
/fashion-elan-shell/
```

instead of the domain root, the Shell uses `basePath.js` to translate between browser paths and internal application routes.

For example:

```text
Browser URL:
/fashion-elan-shell/account/orders

Internal application route:
/account/orders
```

The Vite production base path is configured accordingly.

The project also provides an SPA fallback so direct navigation and hard refreshes can still reach the Shell router when hosted on GitHub Pages.

---
# Integration Status

| Feature | Status |
|---|---|
| Catalog & Discovery integration | ✅ Working |
| Cart & Checkout integration | ✅ Working |
| Account & Orders integration | ✅ Working |
| Shared Shell routing | ✅ Working |
| Cross-MFE Add to Cart | ✅ Working |
| Cart badge synchronization | ✅ Working |
| Account internal navigation without refresh | ✅ Working |
| Catalog → Account Wishlist synchronization | ✅ Working |
| Wishlist header active state | ✅ Working |
| Shared header and footer | ✅ Working |
| Event Inspector | ✅ Working |

---

# Final Result

ELAN demonstrates a microfrontend architecture in which:

- Three different frontend frameworks coexist inside one application.
- Each microfrontend is developed independently.
- Each microfrontend is deployed independently.
- The Shell contains integration logic rather than application business logic.
- The Shell owns browser navigation.
- Cross-application communication uses Browser Custom Events.
- Shared UI reacts to events without directly accessing another microfrontend's internal state.
- Catalog, Cart, and Account communicate while remaining loosely coupled.

The final result is one unified **ELAN Fashion & Apparel Marketplace** composed from **React, Vue, and Lit microfrontends** while preserving independent development and deployment.
