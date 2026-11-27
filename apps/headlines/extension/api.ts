// Firefox's native browser namespace uses Promises; modern MV3 Chrome does too.
export const api: typeof chrome =
  (globalThis as typeof globalThis & { browser?: typeof chrome }).browser ?? chrome;
