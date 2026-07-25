// Script çalışmalarının kalıcı kaydı — refresh/import gibi komutların "çalıştı mı,
// hangi ilanı çekebildi, hangisini çekemedi (403/session error)" bilgisini logs/
// altına yazar. Tek kaynak: apify-fetch-car.js ve refresh-stale.js aynı formatı kullanır.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const logsDir = path.resolve(__dirname, '../../logs');

// Dosya adı için güvenli zaman damgası: 2026-07-24T13-05-09-123Z
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

// Bir çalışmanın sonucunu logs/<name>-<timestamp>.json olarak yazar ve yolu döndürür.
// Ayrıca logs/<name>-latest.json'u da günceller (en son çalışmaya hızlı erişim).
export function writeRunLog(name, payload) {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const record = { runAt: new Date().toISOString(), ...payload };
  const body = JSON.stringify(record, null, 2) + '\n';
  const file = path.join(logsDir, `${name}-${stamp()}.json`);
  fs.writeFileSync(file, body, 'utf-8');
  fs.writeFileSync(path.join(logsDir, `${name}-latest.json`), body, 'utf-8');
  return file;
}
