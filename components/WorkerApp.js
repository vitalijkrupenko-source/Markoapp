'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, useRefreshOnFocus, useToast } from './client';
import {
  SLOTS, SLOT_LABEL, capitalize, dayNumber, formatHours, isWeekend, longDate, monthLabel, monthOf,
  shortDate, slotHours, slotTime, weekdayName,
} from '@/lib/dates';

// [title, small line] shown on each shift button.
const SLOT_TEXT = {
  open: (slot, time) => [SLOT_LABEL[slot], time],
  pending: () => ['Prijavljeni', 'čaka potrditev'],
  approved: (slot, time) => ['✓ Potrjeno', time],
  rejected: (slot) => ['Ni izbrano', SLOT_LABEL[slot].toLowerCase()],
  full: (slot) => ['Zasedeno', SLOT_LABEL[slot].toLowerCase()],
  busy: (slot) => ['Ta dan že delate', SLOT_LABEL[slot].toLowerCase()],
};

export default function WorkerApp({ token }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(null);
  const [saving, setSaving] = useState(null);
  const [toastNode, toast] = useToast();
  const base = `/api/w/${encodeURIComponent(token)}`;

  const load = useCallback(async () => {
    try {
      setData(await api(base));
      setFailed(null);
    } catch (err) {
      setFailed(err);
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(load);

  const tap = async (shift) => {
    if (saving) return;
    if (shift.status === 'approved') {
      const phone = data.settings.contactPhone;
      toast(phone ? `Termin je potrjen. Za odpoved pokličite ${phone}.` : 'Termin je potrjen. Za odpoved pokličite kliniko.');
      return;
    }
    if (shift.status !== 'open' && shift.status !== 'pending') return;
    const want = shift.status === 'open';
    // Show the change immediately; the server response replaces it.
    setData((d) => ({
      ...d,
      shifts: d.shifts.map((s) => (s.id === shift.id ? { ...s, status: want ? 'pending' : 'open' } : s)),
    }));
    setSaving(shift.id);
    try {
      setData(await api(base, { method: 'POST', body: { shiftId: shift.id, want } }));
    } catch (err) {
      toast(err.message, { error: true });
      load();
    } finally {
      setSaving(null);
    }
  };

  const view = useMemo(() => {
    if (!data) return null;
    const { today, shifts, settings } = data;
    const mine = shifts.filter((s) => s.status === 'approved');
    const hoursByMonth = new Map();
    for (const s of mine) {
      const m = monthOf(s.date);
      const cur = hoursByMonth.get(m) || { hours: 0, count: 0 };
      hoursByMonth.set(m, { hours: cur.hours + slotHours(settings, s.slot), count: cur.count + 1 });
    }
    const upcoming = shifts.filter((s) => s.date >= today);
    const months = new Map();
    for (const s of upcoming) {
      const m = monthOf(s.date);
      if (!months.has(m)) months.set(m, new Map());
      const days = months.get(m);
      if (!days.has(s.date)) days.set(s.date, {});
      days.get(s.date)[s.slot] = s;
    }
    return {
      upcomingMine: mine.filter((s) => s.date >= today),
      hoursByMonth,
      months,
      hasOpen: upcoming.some((s) => s.status === 'open' || s.status === 'pending'),
    };
  }, [data]);

  if (failed && !data) {
    return (
      <main className="wrap">
        <div className="card empty" style={{ marginTop: '15vh' }}>
          <p><b>{failed.status === 404 ? 'Povezava ne velja' : 'Ni povezave'}</b></p>
          <p>{failed.message}</p>
          {failed.status !== 404 && <button className="btn btn-primary" onClick={load}>Poskusi znova</button>}
        </div>
      </main>
    );
  }
  if (!data) return <main className="wrap"><p className="muted">Nalagam …</p></main>;

  const { settings, worker } = data;

  return (
    <main className="wrap">
      {toastNode}
      <header className="hello">
        <div className="clinic">{settings.clinicName}</div>
        <h1>Pozdravljeni, {worker.name.split(' ')[0]}</h1>
      </header>

      <section className="card mine">
        <h3>Moj urnik</h3>
        {view.hoursByMonth.size > 0 && (
          <div className="hours" style={{ marginTop: 6 }}>
            {[...view.hoursByMonth].map(([m, v]) => (
              <span key={m}>{capitalize(monthLabel(m).split(' ')[0])}: <b>{formatHours(v.hours)}</b> <span className="muted small">({v.count}×)</span></span>
            ))}
          </div>
        )}
        {view.upcomingMine.length ? (
          <ul>
            {view.upcomingMine.map((s) => (
              <li key={s.id}>
                <b>{capitalize(longDate(s.date))}</b>
                <span>{SLOT_LABEL[s.slot]} {slotTime(settings, s.slot)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small" style={{ margin: '6px 0 0' }}>Še nimate potrjenih terminov.</p>
        )}
      </section>

      <h2>Kdaj lahko delate?</h2>
      {view.months.size === 0 ? (
        <div className="card empty">Trenutno ni prostih terminov.<br />Ko bodo objavljeni, vas obvestimo.</div>
      ) : (
        <>
          {view.hasOpen && (
            <p className="hint">Tapnite vse termine, ki vam ustrezajo. Ko jih klinika potrdi, se tukaj obarvajo <b>zeleno</b>. Ponoven tap prijavo prekliče.</p>
          )}
          {[...view.months].map(([m, days]) => (
            <section key={m} className="card" style={{ paddingTop: 8, paddingBottom: 8 }}>
              <h3 className="month-title" style={{ margin: '8px 0 4px' }}>{monthLabel(m)}</h3>
              {[...days].map(([date, slots]) => (
                <div className="dayrow" key={date}>
                  <div className={`date${isWeekend(date) ? ' weekend' : ''}`}>
                    {dayNumber(date)}. {Number(date.slice(5, 7))}.
                    <small>{weekdayName(date)}</small>
                  </div>
                  {SLOTS.map((slot) => {
                    const s = slots[slot];
                    if (!s) return <div key={slot} className="slot none" aria-hidden="true" />;
                    const [title, sub] = SLOT_TEXT[s.status](slot, slotTime(settings, slot));
                    const clickable = s.status === 'open' || s.status === 'pending' || s.status === 'approved';
                    return (
                      <button
                        key={slot}
                        className={`slot ${s.status}`}
                        onClick={() => tap(s)}
                        disabled={!clickable}
                        aria-label={`${shortDate(date)} ${SLOT_LABEL[slot]}: ${title}`}
                      >
                        {title}
                        <small>{sub}</small>
                      </button>
                    );
                  })}
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </main>
  );
}
