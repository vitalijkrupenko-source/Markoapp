// Date helpers shared by server and browser. Dates are plain 'YYYY-MM-DD' strings
// and months are 'YYYY-MM' strings, always interpreted in the clinic's time zone.

export const TIME_ZONE = 'Europe/Ljubljana';

const MONTHS = [
  'januar', 'februar', 'marec', 'april', 'maj', 'junij',
  'julij', 'avgust', 'september', 'oktober', 'november', 'december',
];
const DAYS_SHORT = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'];
const DAYS_LONG = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];

export const SLOTS = ['am', 'pm'];
export const SLOT_LABEL = { am: 'Dopoldne', pm: 'Popoldne' };

export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function isISODate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime());
}

export function isMonth(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

function parse(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function monthOf(iso) {
  return iso.slice(0, 7);
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthName(month) {
  return MONTHS[Number(month.split('-')[1]) - 1];
}

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayMon(iso) {
  return (parse(iso).getUTCDay() + 6) % 7;
}

export function isWeekend(iso) {
  return weekdayMon(iso) >= 5;
}

/** "pon, 5. 10." */
export function shortDate(iso) {
  const d = parse(iso);
  return `${DAYS_SHORT[d.getUTCDay()]}, ${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`;
}

/** "ponedeljek, 5. oktober" */
export function longDate(iso) {
  const d = parse(iso);
  return `${DAYS_LONG[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}

/** "ponedeljek" */
export function weekdayName(iso) {
  return DAYS_LONG[parse(iso).getUTCDay()];
}

export function dayNumber(iso) {
  return Number(iso.slice(8, 10));
}

export const WEEKDAY_HEADERS = ['pon', 'tor', 'sre', 'čet', 'pet', 'sob', 'ned'];

/** "08:00" -> "8:00" */
export function prettyTime(t) {
  return t.replace(/^0(\d)/, '$1');
}

export function slotTime(settings, slot) {
  return `${prettyTime(settings[`${slot}Start`])}–${prettyTime(settings[`${slot}End`])}`;
}

export function slotHours(settings, slot) {
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  let diff = toMin(settings[`${slot}End`]) - toMin(settings[`${slot}Start`]);
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

export function formatHours(h) {
  return `${Number.isInteger(h) ? h : h.toFixed(1).replace('.', ',')} h`;
}
