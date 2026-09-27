// Slovenian wording helpers shared by the admin screens.

import { workerLink } from '../client';

/** Slovenian plural: forms = [1, 2, 3–4, 5+]. */
export function plural(n, forms) {
  const m = Math.abs(n) % 100;
  const form = m === 1 ? forms[0] : m === 2 ? forms[1] : m === 3 || m === 4 ? forms[2] : forms[3];
  return `${n} ${form}`;
}

export const people = (n) => plural(n, ['oseba', 'osebi', 'osebe', 'oseb']);
export const shiftsWord = (n) => plural(n, ['izmena', 'izmeni', 'izmene', 'izmen']);
export const daysWord = (n) => plural(n, ['dan', 'dneva', 'dnevi', 'dni']);

export function linkMessage(settings, token) {
  return `Pozdravljeni! To je vaša osebna povezava za prijavo na delo (${settings.clinicName}): ${workerLink(token)}\nShranite si jo, velja vsak mesec.`;
}

export function newDatesMessage(settings) {
  return `Pozdravljeni! Objavljeni so novi termini za delo (${settings.clinicName}). Prijavite se na svoji osebni povezavi.`;
}

export function updatedMessage(settings) {
  return `Pozdravljeni! Razpored (${settings.clinicName}) je posodobljen. Na svoji osebni povezavi preverite, kateri termini so vam potrjeni.`;
}
