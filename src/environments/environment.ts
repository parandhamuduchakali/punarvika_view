/** Development configuration. `environment.prod.ts` replaces this at build time. */
export const environment = {
  production: false,
  /**
   * The backend origin. Only ever a base URL -- no keys, no secrets. Anything
   * shipped in this file reaches every visitor's browser.
   */
  apiBaseUrl: 'http://127.0.0.1:8000/api/v1',
  currency: 'INR',
};
