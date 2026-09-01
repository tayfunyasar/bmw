// Bayi merge'i sonrasinda kazanilan VIN/hasar/donanim sinyalleriyle kok kaydin
// hedefini yeniden hesaplar. Saf karar route-listing'de, dosya tasimasi store'dadir.

import { determineTargetFile } from './route-listing.js';
import { moveCar, listingsDir } from './listings-store.js';
import { pushAudit, isManuallyMarkedKazali } from './move-listing.js';

export function rerouteAfterMerge({ sourceCategory, car, rawCar, dryRun = false, dir = listingsDir }) {
  if (!sourceCategory || !car) return null;
  if (sourceCategory.includes('KAZALI') && isManuallyMarkedKazali(car)) return null;

  const routed = determineTargetFile(car, rawCar || {});
  if (routed.target === sourceCategory) return null;

  const reason = routed.reason || routed.bodyStyleReason || 'Birleşen bayi verileriyle yeniden sınıflandırıldı';
  const result = { listingId: car.listingId, from: sourceCategory, to: routed.target, reason };
  if (dryRun) return result;

  pushAudit(car, `Dosya Taşıma: ${sourceCategory} → ${routed.target}`, reason);
  moveCar(sourceCategory, routed.target, car, dir);
  return result;
}
