/* Shared by background, content and options; no remote code or API credentials. */
(() => {
  const defaults = { enabled: true, threshold: 80, mode: 'mark' };
  function settingsFrom(value = {}) {
    if (!value || typeof value !== 'object') value = {};
    return {
      enabled: typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled,
      threshold: typeof value.threshold === 'number' && Number.isFinite(value.threshold)
        ? Math.round(Math.max(0, Math.min(100, value.threshold))) : defaults.threshold,
      mode: value.mode === 'hide' ? 'hide' : 'mark',
    };
  }
  function imageUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
      if (!['licdn.com', 'fbcdn.net'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
      return url.href;
    } catch { return null; }
  }
  globalThis.JevImages = { defaults, settingsFrom, imageUrl, api: globalThis.browser || globalThis.chrome };
})();
