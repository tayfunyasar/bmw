import { pushAudit } from './move-listing.js';

export const SOLD_ACTION = 'İlan Satıldı';

export function pushSoldAudit(car, sourceFileName, detail) {
  pushAudit(car, SOLD_ACTION, detail ?? `${sourceFileName} dosyasından SOLD olarak taşındı`);
}
