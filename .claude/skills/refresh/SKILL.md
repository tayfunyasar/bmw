---
name: refresh
description: Stale (3+ gündür taranmamış) ilanları `npm run refresh` ile Apify'dan yeniden tarar. Apify mobile.de'ye karşı sık sık `403` / "Detected a session error, rotating session..." verip ilanı çekemez; bu durumda ilanın gerçekten kaybolup kaybolmadığı otomatik anlaşılamaz. Skill, refresh sonrası hâlâ stale kalan (= veri çekilemeyen) ilanları Chrome'da tek tek açar: sayfa "Bu araç mevcut değil" gibi boş dönerse ilan satılmış/kaldırılmış demektir ve `npm run move:sell` ile SOLD arşivine taşınır; sayfada ilan içeriği (fiyat, km vb.) dolu gelirse ilan geçerli sayılır ve dokunulmaz. TRIGGER: kullanıcı "/refresh", "refresh", "ilanları yenile", "stale ilanları tara" dediğinde.
---

# Refresh (Stale İlan Yenileme + 403 Kurtarma)

Kullanıcı `/refresh` dediğinde stale ilanları Apify ile yeniden tarar. Apify mobile.de'ye karşı sık sık `403` / session error yer; bu durumda başarısız ilanın gerçekten kaybolup kaybolmadığı otomatik anlaşılamaz, Chrome ile gözle teyit gerekir.

## Adımlar

1. **Refresh çalıştır.** `npm run refresh` (Bash tool). Kullanıcı bir gün eşiği belirttiyse (örn. "5 gün") `npm run refresh -- 5` kullan. Çıktıyı izle: `Blocked by status code 403` / `Detected a session error` / `veri bulunamadı` / `Batch N hata verdi` satırları başarısızlık sinyalidir.

2. **Başarısız ilanları bul.** Refresh bittikten sonra `node scripts/refresh-stale.js --list` çalıştır (gün eşiği verildiyse `--list 5` gibi ekle). Bu komut Apify'ı **tekrar çağırmaz**, sadece hâlâ stale kalan `mobileDeId` listesini döker — refresh başarılı olan ilanlar taze dump aldığı için listede çıkmaz, sadece 403 yiyip veri çekilemeyenler kalır. Çıktı boşsa: tüm ilanlar başarıyla tarandı → doğrudan Adım 6'ya geç.

3. **Her başarısız ilan için listingUrl'i bul.** `src/data/listings/COUPE_GAS_WITH_SUNROOF/` klasöründe o `mobileDeId`'yi grep ile bul (her araç kendi `<listingId>.json` dosyasında), `listingUrl` alanını al.

4. **Chrome'da aç ve kontrol et.** Önce `mcp__claude-in-chrome__tabs_context_mcp` ile sekme bağlamını al (gerekirse `createIfEmpty: true`). Eklenti bağlı değilse kullanıcıya bağlamasını söyle ve bekle. Her başarısız ID için:
   - `listingUrl`'i `navigate` ile aç, `get_page_text` ile sayfa metnini oku.
   - **Karar:**
     - Sayfa "Bu araç mevcut değil" / boş / ilan içeriği yok → ilan **kayıp/satılmış**.
     - Sayfada ilan içeriği dolu (fiyat, km, donanım vb.) → ilan **geçerli**, dokunma.

5. **Kayıp ilanları SOLD'a taşı.** Kayıp olarak tespit edilen her ID için `npm run move:sell -- <mobileDeId>` çalıştır. Tek ve net bir kayıp ilan varsa doğrudan taşı. Birden fazla kayıp ilan varsa, taşımadan önce listeyi kullanıcıya gösterip onay al.

6. **Rapor ver.** Kaç ilan tarandı, kaç tanesi başarıyla yenilendi, kaç tanesi 403 yedi; 403 yiyenlerden kaç tanesi geçerli kaç tanesi satılmış; `move:sell` ile SOLD'a taşınanları `listingId (mobileDeId)` olarak listele.

## Notlar

- Stale tespiti tek kaynak: `scripts/refresh-stale.js`. `--list` mantığını veya dump tarama mantığını skill içine / inline node koduna kopyalama — DRY.
- `move:sell` ilanı aktif listeden `COUPE_GAS_WITH_SUNROOF_SOLD.json`'a taşır; git ile geri alınabilir.
- mobile.de cookie / GDPR banner gösterebilir — en gizlilik dostu seçeneği seç, rabbit-hole'a girme; 2-3 denemeden sonra kullanıcıya sor.
- 403 genelde IP/bot bloğudur, ilana özel değildir — bir batch'teki ilanların hepsi birden başarısız olabilir. Adım 2 hepsini yakalar.
