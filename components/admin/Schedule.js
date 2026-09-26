'use client';

import { useMemo, useState } from 'react';
import { api, smsHref } from '../client';
import {
  SLOTS, SLOT_LABEL, WEEKDAY_HEADERS, dayNumber, daysInMonth, formatHours, isWeekend, longDate,
  capitalize, slotTime, weekdayMon,
} from '@/lib/dates';
import { daysWord, newDatesMessage, people } from './text';

export default function Schedule({ data, derived, run, toast, busy, proposal, setProposal }) {
  const [adding, setAdding] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);

  const phones = data.workers.filter((w) => w.active && w.phone).map((w) => w.phone);
  const notifyAction = phones.length
    ? <a className="btn btn-small" href={smsHref(phones, newDatesMessage(data.settings))}>Obvesti vse</a>
    : null;

  const days = useMemo(() => {
    const map = new Map();
    for (const s of data.shifts) {
      if (onlyMissing) {
        const approved = s.requests.filter((r) => r.status === 'approved').length;
        if (approved >= s.needed || s.date < data.today) continue;
      }
      if (!map.has(s.date)) map.set(s.date, {});
      map.get(s.date)[s.slot] = s;
    }
    return [...map];
  }, [data, onlyMissing]);

  const suggest = async () => {
    try {
      const { proposal: next } = await api('/api/admin/smart', { method: 'POST', body: { month: data.month } });
      if (!next.length) {
        toast('Ni česa razporediti: za prosta mesta ni novih prijav.');
        return;
      }
      setAdding(false);
      setProposal(next);
    } catch (err) {
      toast(err.message, { error: true });
    }
  };

  const notifyAll = () => {
    if (!phones.length) toast('Nihče še nima vpisane telefonske številke (zavihek Ljudje).', { error: true });
  };

  return (
    <>
      {!proposal && (
        <div className="toolbar noprint">
          <button className="btn btn-primary" onClick={() => setAdding((a) => !a)}>
            {adding ? 'Zapri' : '+ Dodaj termine'}
          </button>
          <button className="btn" onClick={suggest} disabled={busy || !data.shifts.length}>✨ Pametno razporedi</button>
          {phones.length ? (
            <a className="btn" href={smsHref(phones, newDatesMessage(data.settings))}>✉ Obvesti vse</a>
          ) : (
            <button className="btn" onClick={notifyAll}>✉ Obvesti vse</button>
          )}
        </div>
      )}

      {adding && (
        <AddShifts
          data={data}
          busy={busy}
          onCancel={() => setAdding(false)}
          onSave={async (payload) => {
            const d = await run('POST', '/api/admin/shifts', payload);
            if (!d) return;
            setAdding(false);
            if (d.skipped?.length) {
              toast(`Nekateri dnevi niso spremenjeni, ker je tam potrjenih že več ljudi: ${d.skipped.map((x) => `${dayNumber(x)}.`).join(', ')}`, { error: true });
            } else {
              toast('Termini so dodani. Zdaj obvestite ljudi.', { action: notifyAction });
            }
          }}
        />
      )}

      {data.shifts.length > 0 && (
        <div className="row-between noprint" style={{ marginBottom: 10 }}>
          <div className="summary" style={{ margin: 0 }}>
            <span>Zasedeno <b>{derived.filled}/{derived.needed}</b></span>
            {derived.missing > 0
              ? <span>Manjka še <b>{people(derived.missing)}</b></span>
              : <span><b>Vse zasedeno ✓</b></span>}
          </div>
          <div className="row">
            <div className="seg" role="group" aria-label="Prikaz">
              <button aria-pressed={!onlyMissing} onClick={() => setOnlyMissing(false)}>Vsi</button>
              <button aria-pressed={onlyMissing} onClick={() => setOnlyMissing(true)}>Manjka</button>
            </div>
            <button className="btn btn-small" onClick={() => window.print()}>Natisni</button>
          </div>
        </div>
      )}

      {!data.shifts.length && !adding && (
        <div className="card empty">
          <p><b>Za ta mesec še ni terminov.</b></p>
          <p>Tapnite <b>»+ Dodaj termine«</b>, označite dneve in izberite, koliko ljudi potrebujete.</p>
        </div>
      )}
      {data.shifts.length > 0 && !days.length && (
        <div className="card empty"><b>Vsi prihodnji termini so zasedeni.</b></div>
      )}

      {days.map(([date, slots]) => (
        <div key={date} className={`daycard${date < data.today ? ' past' : ''}`}>
          <div className={`dayhead${isWeekend(date) ? ' weekend' : ''}`}>
            <span>{capitalize(longDate(date))}</span>
            {date === data.today && <span className="fill ok">danes</span>}
          </div>
          {SLOTS.filter((slot) => slots[slot]).map((slot) => (
            <ShiftRow
              key={slot}
              shift={slots[slot]}
              data={data}
              derived={derived}
              run={run}
              busy={busy}
              proposal={proposal}
              setProposal={setProposal}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function ShiftRow({ shift, data, derived, run, busy, proposal, setProposal }) {
  const { workersById, perWorker, workingOn } = derived;
  const name = (id) => workersById.get(id)?.name ?? '—';
  const hoursOf = (id) => formatHours(perWorker.get(id)?.hours ?? 0);

  const approved = shift.requests.filter((r) => r.status === 'approved').map((r) => r.workerId);
  const planned = (proposal || []).filter((p) => p.shiftId === shift.id).map((p) => p.workerId);
  const pending = shift.requests
    .filter((r) => r.status === 'pending' && workersById.get(r.workerId)?.active && !planned.includes(r.workerId))
    .map((r) => r.workerId);
  const taken = approved.length + planned.length;
  const full = approved.length >= shift.needed;
  const fillClass = taken >= shift.needed ? 'ok' : taken > 0 ? 'part' : 'none';

  // Other slot of the same day, including people the proposal puts there.
  const otherSlot = shift.slot === 'am' ? 'pm' : 'am';
  const plannedElsewhere = new Set(
    (proposal || [])
      .filter((p) => p.shiftId !== shift.id && data.shifts.some((s) => s.id === p.shiftId && s.date === shift.date))
      .map((p) => p.workerId),
  );
  const worksOther = (id) => workingOn.get(`${id}|${shift.date}`) === otherSlot || plannedElsewhere.has(id);

  const inShift = new Set([...approved, ...planned, ...pending]);
  const addable = data.workers
    .filter((w) => w.active && !inShift.has(w.id) && !worksOther(w.id))
    .sort((a, b) => perWorker.get(a.id).hours - perWorker.get(b.id).hours || a.name.localeCompare(b.name, 'sl'));

  const approve = (workerId) => run('POST', '/api/admin/assign', { shiftId: shift.id, workerId });
  const remove = (workerId) => {
    if (window.confirm(`Odstranim ${name(workerId)} s tega termina?`)) {
      run('DELETE', '/api/admin/assign', { shiftId: shift.id, workerId });
    }
  };
  const setNeeded = (needed) => {
    if (needed === 0 && !window.confirm('Izbrišem ta termin?')) return;
    run('PATCH', '/api/admin/shifts', { shiftId: shift.id, needed });
  };

  return (
    <div className="shift">
      <div className="shift-head">
        <span className="name">{SLOT_LABEL[shift.slot]}</span>
        <span className="muted small">{slotTime(data.settings, shift.slot)}</span>
        <span className={`fill ${fillClass}`}>{taken}/{shift.needed}</span>
        <div className="stepper" aria-label="Koliko ljudi potrebujete">
          <button onClick={() => setNeeded(shift.needed - 1)} disabled={busy} aria-label="Manj ljudi">−</button>
          <span>{people(shift.needed)}</span>
          <button onClick={() => setNeeded(shift.needed + 1)} disabled={busy || shift.needed >= 10} aria-label="Več ljudi">+</button>
        </div>
      </div>

      <div className="chips">
        {approved.map((id) => (
          <button key={id} className="chip approved" onClick={() => remove(id)} disabled={busy} title="Tapnite za odstranitev">
            ✓ {name(id)} <span aria-hidden="true">×</span>
          </button>
        ))}
        {planned.map((id) => (
          <button
            key={id}
            className="chip plan"
            title="Odstrani iz predloga"
            onClick={() => setProposal((p) => p.filter((x) => !(x.shiftId === shift.id && x.workerId === id)))}
          >
            ★ {name(id)} <span className="h">{hoursOf(id)}</span>
          </button>
        ))}
        {!full && pending.length > 0 && <span className="chip-label">Prijavljeni:</span>}
        {!full && pending.map((id) => {
          const other = worksOther(id);
          return (
            <button
              key={id}
              className="chip"
              onClick={() => approve(id)}
              disabled={busy || other || Boolean(proposal)}
              title={other ? 'Ta dan že dela' : 'Tapnite za potrditev'}
            >
              {name(id)} <span className="h">{other ? `dela ${SLOT_LABEL[otherSlot].toLowerCase()}` : hoursOf(id)}</span>
            </button>
          );
        })}
        {!full && !proposal && addable.length > 0 && (
          <select
            className="chip-select"
            value=""
            onChange={(e) => e.target.value && approve(Number(e.target.value))}
            disabled={busy}
            aria-label="Dodaj osebo"
          >
            <option value="">+ Dodaj osebo</option>
            {addable.map((w) => (
              <option key={w.id} value={w.id}>{w.name} ({hoursOf(w.id)})</option>
            ))}
          </select>
        )}
      </div>
      {full && pending.length > 0 && (
        <div className="others">Prijavili so se še: {pending.map(name).join(', ')}</div>
      )}
    </div>
  );
}

const NEED_OPTIONS = [0, 1, 2, 3, 4];

function AddShifts({ data, busy, onSave, onCancel }) {
  const [selected, setSelected] = useState(() => new Set());
  const [counts, setCounts] = useState({ am: 1, pm: 1 });

  const all = daysInMonth(data.month);
  const future = all.filter((d) => d >= data.today);
  const existing = new Map();
  for (const s of data.shifts) existing.set(s.date, [...(existing.get(s.date) || []), s.slot]);

  const toggle = (date) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(date)) next.delete(date); else next.add(date);
    return next;
  });
  const pick = (filter) => setSelected(new Set([...selected, ...future.filter(filter)]));

  const blanks = weekdayMon(all[0]);
  const canSave = selected.size > 0 && (counts.am > 0 || counts.pm > 0);

  return (
    <div className="card noprint">
      <h3>1. Označite dneve</h3>
      <div className="row" style={{ margin: '10px 0' }}>
        <button className="btn btn-small" onClick={() => pick((d) => !isWeekend(d))}>Vsi delavniki</button>
        <button className="btn btn-small" onClick={() => pick((d) => weekdayMon(d) === 5)}>Sobote</button>
        <button className="btn btn-small" onClick={() => setSelected(new Set())} disabled={!selected.size}>Počisti</button>
      </div>
      <div className="cal">
        {WEEKDAY_HEADERS.map((h) => <div key={h} className="head">{h}</div>)}
        {Array.from({ length: blanks }, (_, i) => <div key={`b${i}`} />)}
        {all.map((date) => (
          <button
            key={date}
            className={`day${isWeekend(date) ? ' weekend' : ''}`}
            aria-pressed={selected.has(date)}
            disabled={date < data.today}
            onClick={() => toggle(date)}
          >
            {dayNumber(date)}
            <span className="dots">{(existing.get(date) || []).map((s) => <i key={s} />)}</span>
          </button>
        ))}
      </div>
      <p className="muted small" style={{ margin: '8px 0 0' }}>Pika pomeni, da termin na ta dan že obstaja.</p>

      <h3 style={{ marginTop: 20 }}>2. Koliko ljudi potrebujete?</h3>
      <div className="needs">
        {SLOTS.map((slot) => (
          <div className="line" key={slot}>
            <span><b>{SLOT_LABEL[slot]}</b> <span className="muted small">{slotTime(data.settings, slot)}</span></span>
            <div className="seg" role="group" aria-label={SLOT_LABEL[slot]}>
              {NEED_OPTIONS.map((n) => (
                <button key={n} aria-pressed={counts[slot] === n} onClick={() => setCounts({ ...counts, [slot]: n })}>
                  {n === 0 ? 'ne' : n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="row">
        <button
          className="btn btn-primary grow"
          disabled={busy || !canSave}
          onClick={() => onSave({ dates: [...selected].sort(), am: counts.am, pm: counts.pm })}
        >
          {selected.size ? `Shrani (${daysWord(selected.size)})` : 'Shrani'}
        </button>
        <button className="btn" onClick={onCancel}>Prekliči</button>
      </div>
    </div>
  );
}
