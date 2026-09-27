'use client';

// How the screens talk to the server. The phone prototype (prototype/) swaps this
// module for one backed by the artifact database; everything else is shared.

import { useEffect } from 'react';

export * from './ui';

export const features = { print: true, logout: true };

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new Error('Ni povezave. Preverite internet in poskusite znova.');
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data.error || 'Nekaj je šlo narobe. Poskusite znova.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export function workerLink(token) {
  return `${window.location.origin}/w/${token}`;
}

/** Props for a link that opens a worker's page (admin preview). */
export function workerOpenProps(token) {
  return { href: workerLink(token), target: '_blank', rel: 'noreferrer' };
}

/** Calls `fn` whenever the tab becomes visible again, so data is never stale. */
export function useRefreshOnFocus(fn) {
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fn(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fn]);
}
