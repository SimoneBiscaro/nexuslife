/** Stati di scadenza condivisi dai componenti (CLAUDE.md §5 e §7). */
export const STATUSES = ['ok', 'warning', 'critical', 'overdue', 'unknown'];

export const STATUS_LABEL = {
  ok: 'In regola',
  warning: 'In avvicinamento',
  critical: 'Urgente',
  overdue: 'Scaduto',
  unknown: 'Dato mancante',
};

export function normalizeStatus(status) {
  return STATUSES.includes(status) ? status : 'unknown';
}
