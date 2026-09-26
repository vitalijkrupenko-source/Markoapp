'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, smsHref, useRefreshOnFocus, useToast } from './client';
import { addMonths, monthLabel, slotHours } from '@/lib/dates';
import Schedule from './admin/Schedule';
import People from './admin/People';
import Settings from './admin/Settings';
import { updatedMessage } from './admin/text';

const TABS = [
  ['schedule', 'Razpored'],
  ['people', 'Ljudje'],
  ['settings', 'Nastavitve'],
];

export default function AdminApp() {
  const [data, setData] = useState(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [tab, setTab] = useState('schedule');
  const [proposal, setProposal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toastNode, toast] = useToast();
  const monthRef = useRef(null);

  const load = useCallback(async (month = monthRef.current) => {
    try {
      const d = await api(`/api/admin/state${month ? `?month=${month}` : ''}`);
      monthRef.current = d.month;
      setData(d);
      setNeedLogin(false);
    } catch (err) {
      if (err.status === 401) setNeedLogin(true);
      else toast(err.message, { error: true });
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(useCallback(() => { if (!proposal) load(); }, [load, proposal]));

  /** Sends a change to the server; the answer is the fresh month state. */
  const run = useCallback(async (method, path, body = {}) => {
    setBusy(true);
    try {
      const d = await api(path, { method, body: { ...body, month: monthRef.current } });
      setData(d);
      return d;
    } catch (err) {
      if (err.status === 401) setNeedLogin(true);
      else toast(err.message, { error: true });
      return null;
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const changeMonth = (delta) => {
    setProposal(null);
    load(addMonths(monthRef.current, delta));
  };

  const derived = useMemo(() => (data ? derive(data) : null), [data]);

  if (needLogin) return <Login onDone={() => load()} />;
  if (!data) return <main className="wrap"><p className="muted">Nalagam …</p></main>;

  const applyProposal = async () => {
    const d = await run('PUT', '/api/admin/smart', { proposal });
    if (!d) return;
    setProposal(null);
    const phones = d.workers.filter((w) => w.active && w.phone).map((w) => w.phone);
    toast(`Potrjenih ${d.saved} dodelitev.`, phones.length ? {
      action: <a className="btn btn-small" href={smsHref(phones, updatedMessage(d.settings))}>Obvesti vse</a>,
    } : {});
  };

  const common = { data, derived, run, toast, busy, month: data.month };

  return (
    <main className="wrap">
      {toastNode}
      <div className="topbar">
        <span className="brand">{data.settings.clinicName}</span>
        <span className="muted small noprint">Razpored dela</span>
      </div>

      <nav className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>

      {tab !== 'settings' && (
        <div className="monthnav">
          <button className="btn" onClick={() => changeMonth(-1)} aria-label="Prejšnji mesec">‹</button>
          <span className="label">{monthLabel(data.month)}</span>
          <button className="btn" onClick={() => changeMonth(1)} aria-label="Naslednji mesec">›</button>
        </div>
      )}

      {tab === 'schedule' && <Schedule {...common} proposal={proposal} setProposal={setProposal} />}
      {tab === 'people' && <People {...common} />}
      {tab === 'settings' && <Settings {...common} onLogout={() => setNeedLogin(true)} />}

      {proposal && tab === 'schedule' && (
        <div className="floatbar plan">
          <div className="text">
            <b>Predlog: {proposal.length} dodelitev</b><br />
            Modro označeni. Tapnite ime, da ga odstranite iz predloga.
          </div>
          <button className="btn" onClick={() => setProposal(null)} disabled={busy}>Prekliči</button>
          <button className="btn btn-primary" onClick={applyProposal} disabled={busy || !proposal.length}>Potrdi predlog</button>
        </div>
      )}
    </main>
  );
}

/** Per-worker totals for the month and quick lookups used by every tab. */
function derive(data) {
  const hours = { am: slotHours(data.settings, 'am'), pm: slotHours(data.settings, 'pm') };
  const workersById = new Map(data.workers.map((w) => [w.id, w]));
  const perWorker = new Map(data.workers.map((w) => [w.id, { hours: 0, shifts: [], pending: 0 }]));
  const workingOn = new Map(); // `${workerId}|${date}` -> slot
  let needed = 0;
  let filled = 0;
  let missing = 0;
  for (const s of data.shifts) {
    const approved = s.requests.filter((r) => r.status === 'approved').length;
    needed += s.needed;
    filled += Math.min(approved, s.needed);
    if (s.date >= data.today) missing += Math.max(0, s.needed - approved);
    for (const r of s.requests) {
      const pw = perWorker.get(r.workerId);
      if (pw && r.status === 'approved') {
        pw.hours += hours[s.slot];
        pw.shifts.push(s);
        workingOn.set(`${r.workerId}|${s.date}`, s.slot);
      }
    }
  }
  // Requests that can still be approved: future, not full, not already working that day.
  for (const s of data.shifts) {
    if (s.date < data.today) continue;
    if (s.requests.filter((r) => r.status === 'approved').length >= s.needed) continue;
    for (const r of s.requests) {
      const pw = perWorker.get(r.workerId);
      if (pw && r.status === 'pending' && !workingOn.has(`${r.workerId}|${s.date}`)) pw.pending += 1;
    }
  }
  return { hours, workersById, perWorker, workingOn, needed, filled, missing };
}

function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: { password } });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="wrap">
      <form className="card login" onSubmit={submit}>
        <h1>Razpored dela</h1>
        <p className="muted">Vpišite geslo. Na tej napravi ga ne bo treba vpisovati znova.</p>
        <label className="field">
          <span>Geslo</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
        </label>
        {error && <p style={{ color: 'var(--bad)' }}>{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !password}>Prijava</button>
      </form>
    </main>
  );
}
