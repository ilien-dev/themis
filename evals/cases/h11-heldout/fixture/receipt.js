import { formatDate } from './utils/dates.js';
export const receiptHeader = (r) => `Receipt #${r.id} — paid ${formatDate(r.paidAt)}`;
