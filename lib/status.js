// Shared by the server and the phone prototype.

/**
 * What a worker sees for each shift:
 *  open      – can apply
 *  pending   – applied, waiting for the decision
 *  approved  – confirmed
 *  rejected  – applied but the shift is filled (or already passed)
 *  full      – shift is filled, did not apply
 *  busy      – already confirmed for the other shift that day
 */
export function statusFor(shift, workerId, approvedDates, today) {
  const mine = shift.requests.find((r) => r.workerId === workerId);
  if (mine?.status === 'approved') return 'approved';
  const full = shift.requests.filter((r) => r.status === 'approved').length >= shift.needed;
  const busy = approvedDates.has(shift.date);
  if (mine) return full || busy || shift.date < today ? 'rejected' : 'pending';
  if (full || shift.date < today) return 'full';
  if (busy) return 'busy';
  return 'open';
}
