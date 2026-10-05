# Punarvika Farms — storefront (`punarvika_view`)

Angular storefront for **Punarvika Farms Pvt. Ltd.** — agriculture, milk, sheep
and goat, and poultry, sold direct from the farm. Payments are **UPI and card
only**.

> *Rooted in dharma, growing for the future.*

The API it talks to lives in [`punarvika_core`](../punarvika_core).

---

## Contents

[Stack](#stack) · [Running it](#running-it) · [Structure](#how-it-is-put-together) ·
[What it does](#what-it-does) · [Deliberate decisions](#things-that-are-deliberate) ·
[Accessibility](#accessibility-and-responsiveness) · [Tests](#tests) ·
[Branding](#branding)

---

## Stack

Angular 22 (standalone components, signals, the built-in control flow) ·
TypeScript 6 · SCSS · vitest. **No UI framework** — the design tokens and
primitives in `src/styles.scss` are the whole design system.

## Running it

```bash
npm install
npm start            # http://localhost:4200
```

The API must be running at the URL in `src/environments/environment.ts`
(`http://127.0.0.1:8000/api/v1` by default):

```bash
cd ../punarvika_core
python -m uvicorn app.main:app --reload
```

`CORS_ORIGINS` in the backend `.env` must include `http://localhost:4200`, which
`.env.example` already does.

```bash
npm run build        # production bundle into dist/
npm test             # vitest, single run
```

`package-lock.json` is committed on purpose: without it `npm install` can resolve
different transitive versions than were tested, so the build that ships would not
be the build that was verified.

## How it is put together

```text
src/app/
├── core/
│   ├── models/        types mirroring the API contract
│   ├── services/      one service per API area, plus session state
│   ├── interceptors/  auth (token + refresh) and error normalisation
│   └── guards/        authGuard · adminGuard · guestGuard
├── shared/            INR/quantity pipes, form-error helpers, UI primitives
├── features/          one lazily-loaded folder per area
└── app.routes.ts      every feature is lazy; admin is a child route bundle
```

A first-time visitor browsing the shop downloads neither the checkout nor the
admin code.

## What it does

**Shop** — browse and search the catalogue, filter by category, price and
availability, sort and page. Filter state lives in the URL, so a filtered view is
shareable, bookmarkable and survives Back.

**Basket and checkout** — live server-side pricing, coupon codes, delivery
address selection, UPI or card, and a payment result page that re-reads the order
rather than trusting the URL.

**Account** — order history with a fulfilment timeline, order detail with retry
payment and cancellation, profile, address book, your own reviews (including ones
still awaiting moderation), and *sign out on all devices*.

**Reviews** — verified-purchase only; the form appears solely when the API says
this customer has taken delivery.

**Farm admin** — dashboard, products with an image manager, categories,
inventory, orders with status transitions, coupons, review moderation, customers,
payments and a read-only audit log.

## Things that are deliberate

**Money is `string`, never `number`.** The API serialises Decimals as strings
(`"70.00"`) precisely because binary floating point cannot represent them.
Parsing them into `number` here would reintroduce exactly the rounding error the
backend avoids. **No total is ever computed in the browser** — every figure on
screen came from the server, so what the customer sees is what they are charged.

**The access token lives in memory only.** `localStorage` would make it readable
by any injected script. The long-lived refresh token is an HttpOnly cookie that
JavaScript cannot read at all, which is why the auth calls set
`withCredentials`. The cost is that a page reload starts signed out, so an app
initializer calls `/auth/refresh` before the first route renders.

**Concurrent 401s share one refresh.** The backend rotates refresh tokens and
treats a replayed one as theft. Without serialising, five parallel failures would
fire five refreshes and four would present an already-replaced token — revoking
the whole session.

**The `returnUrl` after signing in is followed only if it is a same-site path.**
An absolute or protocol-relative URL would make the login page an open redirect.

**Guards decide what renders, not what is allowed.** Every protected resource is
enforced again by the API, so editing past a guard still yields 401, 403 or 404.
`adminGuard` is applied on both the parent route and the admin shell.

**Errors are normalised once.** The error interceptor turns the API envelope into
a single `AppApiError`, and `applyApiErrors` puts server-side validation back on
the form control that caused it. Only failures a component cannot act on (network
down, 5xx) become a toast; a validation error belongs beside its field.

**Customer text is interpolated, never `innerHTML`.** Reviews are written by
customers and read by everyone, so Angular's default escaping is left to do its
job.

## Accessibility and responsiveness

Every page works at phone, tablet and desktop widths. Focus outlines are never
removed, there is a skip link, form fields are labelled and errors wired up with
`aria-describedby`, tap targets are at least 44px, inputs are 16px so iOS Safari
does not zoom on focus, star ratings carry text alternatives, and
`prefers-reduced-motion` is honoured.

## Tests

```bash
npm test             # vitest, single run
```

Weighted towards the places where a bug is expensive rather than towards line
count:

| Area | What is pinned |
|---|---|
| `auth.interceptor` | several simultaneous 401s trigger exactly **one** refresh — the backend treats a replayed refresh token as theft, so getting this wrong revokes the session. Also that a failed refresh does not wedge later requests. |
| `error.interceptor` | the `AppApiError` contract every component relies on, including a non-envelope body from a proxy |
| `auth.guard` | admin, customer and visitor paths, and that access stops the moment the session is cleared |
| API services | that no price, total or user id ever leaves the browser in a request body |
| `InrPipe` | Indian 2,2,3 digit grouping, and that no value round-trips through `number` |
| `CartService` | that state comes wholly from the API |

## Payments in development

With `PAYMENT_GATEWAY=mock` the backend signs with a server-side key, so the
browser cannot produce a valid signature for `/payments/verify`. The checkout
page calls the backend's development-only stand-in for the gateway callback and
says plainly on screen that payment is being simulated. With a real gateway that
block is replaced by the provider's checkout window.

Gateway secrets never reach the browser — only the gateway's public key id does.

## Branding

Taken from the company logo rather than invented: **Punarvika Farms Pvt. Ltd.**,
the tagline *"Rooted in dharma, growing for the future"*, and the four pillars
(agriculture, milk, sheep and goat, poultry) that the navigation and seed
catalogue follow.

The logo itself lives at `public/assets/logo.jpeg` and is referenced as
`assets/logo.jpeg` in the header, hero and apple-touch-icon. Angular copies only
`public/` into a build — a file left in `src/assets` is silently not shipped.

Palette (`src/styles.scss`): leaf green `#2f6b3d`, cream `#fdfaf4`, earth brown
`#8a5a2b`, matching the logo.
