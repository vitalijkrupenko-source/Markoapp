// Data layer of the phone prototype. Live mode mirrors the artifact's shared
// database (so the clinic and workers on different phones see each other's
// changes); when that database is not available the example data below is
// kept in this browser only.

import { exampleData } from './seed';

const COLLECTIONS = ['workers', 'shifts', 'requests', 'settings'];
const LOCAL_KEY = 'urnik-prototip-v1';

const mirror = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));
const listeners = new Set();
let db = null;
let readyResolve;

export const status = { mode: 'loading' };
export const ready = new Promise((resolve) => { readyResolve = resolve; });

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function all(collection) {
  return [...mirror[collection].values()];
}

export function get(collection, id) {
  return mirror[collection].get(id);
}

export async function put(collection, id, data) {
  mirror[collection].set(id, data);
  notify();
  if (db) await db.collection(collection).doc(id).set(data);
  else saveLocal();
}

export async function remove(collection, id) {
  mirror[collection].delete(id);
  notify();
  if (db) await db.collection(collection).doc(id).delete();
  else saveLocal();
}

function saveLocal() {
  try {
    const plain = Object.fromEntries(COLLECTIONS.map((c) => [c, Object.fromEntries(mirror[c])]));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(plain));
  } catch {}
}

function startLocal() {
  if (status.mode !== 'loading') return;
  db = null;
  let data = null;
  try { data = JSON.parse(localStorage.getItem(LOCAL_KEY)); } catch {}
  if (!data) data = exampleData();
  for (const c of COLLECTIONS) mirror[c] = new Map(Object.entries(data[c] || {}));
  status.mode = 'local';
  readyResolve();
  notify();
}

async function start() {
  const fallback = setTimeout(startLocal, 15000);
  let namespace = null;
  try {
    namespace = window.claude?.use ? await window.claude.use('db') : null;
  } catch {}
  if (!namespace) {
    clearTimeout(fallback);
    startLocal();
    return;
  }
  const waiting = new Set(COLLECTIONS);
  for (const c of COLLECTIONS) {
    namespace.collection(c).onSnapshot(
      (snap) => {
        mirror[c] = new Map(snap.docs.map((d) => [d.id, d.data()]));
        if (waiting.delete(c) && waiting.size === 0 && status.mode === 'loading') {
          clearTimeout(fallback);
          db = namespace;
          status.mode = 'live';
          readyResolve();
        }
        notify();
      },
      (err) => {
        console.warn('db', c, err);
        if (status.mode === 'loading') {
          clearTimeout(fallback);
          startLocal();
        }
      },
    );
  }
}

start();
