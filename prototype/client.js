// Stand-in for components/client.js inside the phone prototype: the same
// exports, but requests go to the in-browser API instead of the server.

import { useEffect } from 'react';
import { route } from './server';
import { subscribe } from './store';

export * from '../components/ui';

export const features = { print: false, logout: false };

export async function api(path, { method = 'GET', body } = {}) {
  try {
    return structuredClone(await route(method, path, body || {}));
  } catch (err) {
    const e = new Error(err.code
      ? 'Shranjevanje ni uspelo. Preverite, ali imate dostop za urejanje, in poskusite znova.'
      : err.message || 'Nekaj je šlo narobe. Poskusite znova.');
    e.status = err.status || 500;
    throw e;
  }
}

/** The link a worker receives: this artifact's address plus their personal code. */
export function workerLink(token) {
  return `${window.URNIK_SHARE_URL || window.location.href.split('#')[0]}#w-${token}`;
}

export function workerOpenProps(token) {
  return { href: `#w-${token}` };
}

/** Reloads when the tab comes back and whenever anyone changes the shared data. */
export function useRefreshOnFocus(fn) {
  useEffect(() => {
    let timer;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(fn, 150);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') fn(); };
    document.addEventListener('visibilitychange', onVisible);
    const unsubscribe = subscribe(later);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fn]);
}
