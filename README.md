# Punarvika Farms — storefront (`punarvika_view`)

Angular frontend for the Punarvika Farms direct-to-customer store: dairy, poultry,
eggs and farm produce, with **UPI and card payments only**.

The API it talks to lives in [`punarvika_core`](../punarvika_core).

## Stack

Angular 22 (standalone components, signals, the new control flow) · TypeScript 6 ·
SCSS · vitest. No UI framework — the design tokens and primitives in
`src/styles.scss` are the whole design system.

## Running it

```bash
npm install
npm start            # http://localhost:4200
```

The API must be running at the URL in `src/environments/environment.ts`
(`http://127.0.0.1:8000/api/v1` by default). To start it:

```bash
cd ../punarvika_core
python -m uvicorn app.main:app --reload
```

`CORS_ORIGINS` in the backend `.env` must include `http://localhost:4200`, and it
already does in `.env.example`.

```bash
npm run build        # production bundle into dist/
npm test             # vitest, single run
```

## How it is put together

```text
src/app/
├── core/
│   ├── models/        types mirroring the API contract
│   ├── services/      one service per API area, plus session state
│   ├── interceptors/  auth (token + refresh) and error normalisation
│   └── guards/        authGuard, adminGuard, guestGuard
├── shared/            INR/quantity pipes, form-error helpers, UI primitives
├── features/          one lazily-loaded folder per area
└── app.routes.ts      every feature is lazy; admin is a child route bundle
```

A first-time visitor browsing the shop downloads neither the checkout nor the
admin code.

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
enforced again by the API, so editing past a guard still yields a 401, 403 or
404. `adminGuard` is applied on both the parent route and the admin shell.

**Errors are normalised once.** The error interceptor turns the API envelope into
a single `AppApiError`, and `applyApiErrors` puts server-side validation back on
the form control that caused it. Only failures a component cannot act on
(network down, 5xx) become a toast; a validation error belongs beside its field.

## Accessibility and responsiveness

Every page works at phone, tablet and desktop widths. Focus outlines are never
removed, there is a skip link, form fields are labelled and errors are wired with
`aria-describedby`, tap targets are at least 44px, inputs are 16px so iOS Safari
does not zoom on focus, and `prefers-reduced-motion` is honoured.

## Payments in development

With `PAYMENT_GATEWAY=mock` the backend signs with a server-side secret, so the
browser cannot produce a valid signature for `/payments/verify`. The checkout
page therefore calls the backend's development-only stand-in for the gateway
callback and says plainly on screen that payment is being simulated. With a real
gateway that block is replaced by the provider's checkout window, which returns a
payment id and signature for `/payments/verify`.

Gateway secrets never reach the browser — only the gateway's public key id does.

## Note on `package-lock.json`

The repository's `.gitignore` excludes it. That is the existing project choice
and has been left alone, but it does mean builds are not reproducible across
machines; committing the lockfile would fix that.
