'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

/** Opens the phone's own SMS app with the message filled in. */
export function smsHref(numbers, text) {
  const list = [].concat(numbers).map((n) => String(n).replace(/[^\d+]/g, '')).filter(Boolean);
  const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const body = encodeURIComponent(text);
  if (apple) {
    return list.length > 1
      ? `sms:/open?addresses=${list.join(',')}&body=${body}`
      : `sms:${list[0] || ''}&body=${body}`;
  }
  return `sms:${list.join(',')}?body=${body}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Kopirajte besedilo:', text);
    return false;
  }
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((message, opts = {}) => {
    clearTimeout(timer.current);
    setToast({ message, ...opts });
    timer.current = setTimeout(() => setToast(null), opts.action ? 9000 : 4000);
  }, []);
  const node = toast && (
    <div className={`toast${toast.error ? ' error' : ''}`} role="status">
      <div className="grow">{toast.message}</div>
      {toast.action}
      <button className="btn btn-small" onClick={() => setToast(null)} aria-label="Zapri">✕</button>
    </div>
  );
  return [node, show];
}

/** Calls `fn` whenever the tab becomes visible again, so data is never stale. */
export function useRefreshOnFocus(fn) {
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fn(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fn]);
}
