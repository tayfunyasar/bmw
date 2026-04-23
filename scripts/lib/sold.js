export const SOLD_ACTION = 'İlan Satıldı';

export function pushSoldAudit(car, sourceFileName, detail) {
  car.auditHistory = car.auditHistory || [];
  car.auditHistory.push({
    action: SOLD_ACTION,
    detail: detail ?? `${sourceFileName} dosyasından SOLD olarak taşındı`,
    changes: null,
    auditDate: new Date().toISOString()
  });
  car.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));
}
