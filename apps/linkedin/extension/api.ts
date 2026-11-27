// Firefox exposes promise-based WebExtension APIs through browser; Chrome uses chrome.
export const api: typeof chrome =
  (globalThis as typeof globalThis & { browser?: typeof chrome }).browser ?? globalThis.chrome;
