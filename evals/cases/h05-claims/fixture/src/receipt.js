import { lineTotal } from './lines.js';
export const receiptRow = (l) => `${l.sku} x${l.qty} ${lineTotal(l)}`;
