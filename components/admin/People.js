'use client';

import { useState } from 'react';
import { copyText, smsHref } from '../client';
import { SLOT_LABEL, dayNumber, formatHours } from '@/lib/dates';
import { linkMessage, people, plural, shiftsWord, workerLink } from './text';

export default function People({ data, derived, run, toast, busy }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sort, setSort] = useState('name');
  const [editing, setEditing] = useState(null);

  const { perWorker } = derived;
  const maxHours = Math.max(1, ...[...perWorker.values()].map((p) => p.hours));
  const working = data.workers.filter((w) => perWorker.get(w.id).hours > 0);
  const totalHours = working.reduce((sum, w) => sum + perWorker.get(w.id).hours, 0);

  const list = [...data.workers].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (sort === 'hours') return perWorker.get(b.id).hours - perWorker.get(a.id).hours;
    return a.name.localeCompare(b.name, 'sl');
  });

  const add = async (e) => {
    e.preventDefault();
    const before = new Set(data.workers.map((w) => w.id));
    const d = await run('POST', '/api/admin/workers', { name, phone });
    if (!d) return;
    setName('');
    setPhone('');
    const added = d.workers.find((w) => !before.has(w.id));
    toast(`Dodano: ${added?.name ?? ''}. Zdaj pošljite osebno povezavo.`, added?.phone ? {
      action: <a className="btn btn-small" href={smsHref(added.phone, linkMessage(d.settings, added.token))}>Pošlji SMS</a>,
    } : {});
  };

  const copy = async (w) => {
    if (await copyText(linkMessage(data.settings, w.token))) toast('Sporočilo s povezavo je kopirano.');
  };

  return (
    <>
      <form className="card noprint" onSubmit={add}>
        <h3 style={{ marginBottom: 10 }}>Dodaj osebo</h3>
        <div className="row">
          <input className="input grow" style={{ flexBasis: 180 }} placeholder="Ime in priimek" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input grow" style={{ flexBasis: 150 }} placeholder="Telefon" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !name.trim()}>Dodaj</button>
        </div>
      </form>

      {data.workers.length > 0 && (
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div className="summary" style={{ margin: 0 }}>
            <span>Dela: <b>{people(working.length)}</b></span>
            <span>Skupaj <b>{formatHours(totalHours)}</b></span>
            {working.length > 0 && <span>Povprečno <b>{formatHours(Math.round((totalHours / working.length) * 10) / 10)}</b></span>}
          </div>
          <div className="seg" role="group" aria-label="Razvrsti">
            <button aria-pressed={sort === 'name'} onClick={() => setSort('name')}>Ime</button>
            <button aria-pressed={sort === 'hours'} onClick={() => setSort('hours')}>Ure</button>
          </div>
        </div>
      )}

      {!data.workers.length && (
        <div className="card empty">
          <p><b>Še ni nikogar.</b></p>
          <p>Zgoraj dodajte ljudi. Vsak dobi svojo povezavo, ki jo pošljete po SMS-u samo enkrat.</p>
        </div>
      )}

      {list.map((w) => {
        const p = perWorker.get(w.id);
        if (editing === w.id) {
          return <EditPerson key={w.id} worker={w} run={run} busy={busy} onClose={() => setEditing(null)} />;
        }
        return (
          <div key={w.id} className={`card person${w.active ? '' : ' inactive'}`}>
            <div className="top">
              <span className="name">{w.name}{!w.active && <span className="muted small"> · izključen/a</span>}</span>
              <span><b>{formatHours(p.hours)}</b> <span className="muted small">· {shiftsWord(p.shifts.length)}</span></span>
            </div>
            <div className="bar"><i style={{ width: `${(p.hours / maxHours) * 100}%` }} /></div>
            <div className="dates">
              {p.shifts.length
                ? p.shifts.map((s) => `${dayNumber(s.date)}. ${SLOT_LABEL[s.slot].slice(0, 3).toLowerCase()}`).join(' · ')
                : 'Ta mesec nima potrjenih terminov.'}
              {p.pending > 0 && <> · <span style={{ color: 'var(--wait)' }}>{plural(p.pending, ['prijava čaka', 'prijavi čakata', 'prijave čakajo', 'prijav čaka'])}</span></>}
            </div>
            <div className="row noprint">
              {w.phone && w.active && (
                <a className="btn btn-small" href={smsHref(w.phone, linkMessage(data.settings, w.token))}>✉ Pošlji povezavo</a>
              )}
              <button className="btn btn-small" onClick={() => copy(w)}>Kopiraj</button>
              <a className="btn btn-small" href={workerLink(w.token)} target="_blank" rel="noreferrer">Odpri</a>
              <button className="btn btn-small" onClick={() => setEditing(w.id)}>Uredi</button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function EditPerson({ worker, run, busy, onClose }) {
  const [name, setName] = useState(worker.name);
  const [phone, setPhone] = useState(worker.phone);

  const save = async (patch) => {
    const d = await run('PATCH', '/api/admin/workers', { id: worker.id, name, phone, active: worker.active, ...patch });
    if (d) onClose();
  };
  const remove = async () => {
    if (!window.confirm(`Res izbrišem ${worker.name}? Izbrišejo se tudi vse prijave in potrjeni termini te osebe.`)) return;
    const d = await run('DELETE', '/api/admin/workers', { id: worker.id });
    if (d) onClose();
  };

  return (
    <div className="card">
      <label className="field"><span>Ime</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field"><span>Telefon</span>
        <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn btn-primary" onClick={() => save({})} disabled={busy || !name.trim()}>Shrani</button>
        <button className="btn" onClick={onClose}>Prekliči</button>
        <span className="grow" />
        <button className="btn btn-small" onClick={() => save({ active: !worker.active })} disabled={busy}>
          {worker.active ? 'Izključi (ne dela več)' : 'Vključi nazaj'}
        </button>
        <button className="btn btn-small btn-danger" onClick={remove} disabled={busy}>Izbriši</button>
      </div>
      {worker.active && (
        <p className="muted small" style={{ marginBottom: 0 }}>Izključena oseba ne more več odpreti svoje povezave, podatki pa ostanejo.</p>
      )}
    </div>
  );
}
