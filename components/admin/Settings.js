'use client';

import { useState } from 'react';
import { api } from '../client';
import { SLOT_LABEL } from '@/lib/dates';

export default function Settings({ data, run, toast, busy, onLogout }) {
  const [form, setForm] = useState(data.settings);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    if (await run('PUT', '/api/admin/settings', { settings: form })) toast('Shranjeno.');
  };

  const logout = async () => {
    await api('/api/admin/login', { method: 'DELETE' }).catch(() => {});
    onLogout();
  };

  return (
    <>
      <form className="card" onSubmit={save}>
        <label className="field"><span>Ime klinike (vidijo ga vsi)</span>
          <input className="input" value={form.clinicName} onChange={set('clinicName')} />
        </label>
        {['am', 'pm'].map((slot) => (
          <div className="field" key={slot}>
            <span>{SLOT_LABEL[slot]}</span>
            <div className="row">
              <input className="input input-time" type="time" value={form[`${slot}Start`]} onChange={set(`${slot}Start`)} required />
              <span>do</span>
              <input className="input input-time" type="time" value={form[`${slot}End`]} onChange={set(`${slot}End`)} required />
            </div>
          </div>
        ))}
        <label className="field"><span>Telefon za odpovedi (pokažemo ga, če želi kdo odpovedati potrjen termin)</span>
          <input className="input" type="tel" value={form.contactPhone} onChange={set('contactPhone')} placeholder="npr. 041 123 456" />
        </label>
        <button className="btn btn-primary" disabled={busy}>Shrani</button>
      </form>

      <div className="card">
        <h3>Kako deluje</h3>
        <ol style={{ paddingLeft: 20, marginBottom: 0 }}>
          <li><b>Ljudje:</b> vsako osebo dodajte enkrat in pošljite osebno povezavo. Ta velja vedno.</li>
          <li><b>Razpored → Dodaj termine:</b> označite dneve in koliko ljudi potrebujete.</li>
          <li><b>Obvesti vse:</b> odpre se vaš SMS z že napisanim sporočilom za vse.</li>
          <li>Ljudje na svoji povezavi označijo, kdaj lahko delajo. Hitrost ni pomembna.</li>
          <li>Tapnite ime, da ga potrdite, ali uporabite <b>Pametno razporeditev</b>, ki ure razdeli čim bolj enakomerno. Predlog najprej pregledate.</li>
          <li>Potrjeni ljudje na svoji povezavi takoj vidijo zeleno kljukico.</li>
        </ol>
      </div>

      <button className="btn" onClick={logout}>Odjava</button>
    </>
  );
}
