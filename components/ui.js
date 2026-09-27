'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Browser-side helpers shared by every screen.

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

const confirmHosts = new Set();

/** In-page yes/no question (the browser's confirm() is blocked in some embeds). */
export function askConfirm(message, okLabel = 'Da') {
  return new Promise((resolve) => {
    if (!confirmHosts.size) {
      resolve(window.confirm(message));
      return;
    }
    confirmHosts.forEach((show) => show({ message, okLabel, resolve }));
  });
}

export function ConfirmHost() {
  const [ask, setAsk] = useState(null);
  useEffect(() => {
    confirmHosts.add(setAsk);
    return () => { confirmHosts.delete(setAsk); };
  }, []);
  if (!ask) return null;
  const answer = (value) => {
    setAsk(null);
    ask.resolve(value);
  };
  return (
    <div className="modal-back" onClick={() => answer(false)}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p>{ask.message}</p>
        <div className="row">
          <button className="btn grow" onClick={() => answer(false)}>Prekliči</button>
          <button className="btn btn-primary grow" onClick={() => answer(true)} autoFocus>{ask.okLabel}</button>
        </div>
      </div>
    </div>
  );
}
