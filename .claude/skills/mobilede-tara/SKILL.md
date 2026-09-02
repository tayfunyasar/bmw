---
name: mobilede-tara
description: TAM TARAMA dongusu — (1) BOOKMARKS.json'daki mobile.de M440i/M440d aramasini Chrome'da tarar (sponsorlu/GC/Cabrio elenir, ardisik 7 existing'de durur, yeniler `npm run import:apify`), (2) 2 gun esikle stale ilanlari `refresh` akisiyla yeniler (403 kurtarma + move:sell), (3) 7 bayi sitesini `bayi-tara` ortak akisiyla tarar (yeni bulunanlar `npm run import:dealer` ile SITE/ klasorlerine, mobile.de ikizleri otomatik dedup), (4) birlesik rapor + session-bound 3h loop'u yeniden kurar. TRIGGER - kullanici "mobilede tara", "mobile.de tara", "mobile de tara", "yeni ilan tara", "yeni ilanlari tara", "mobilede yeni ilan var mi", "tarama yap", "tam tarama", "/mobilede-tara" yazdiginda — slash olsun olmasin DOGRUDAN calistir, secenek sunma.
---

# mobile.de Tara

Kullanici `/mobilede-tara` dedigi zaman: BOOKMARKS.json icindeki "mobile.de — M440i/M440d xDrive ..." linkini Chrome'da yeni bir sekmede ac. Sayfa sayfa ilan topla; **kept (filtreden gecmis) listede ardisik 7 existing** gorduktan sonra dur. Sponsorlu reklamlari ve Gran Coupé / Cabrio araclari listeleme — bu eleme `scripts/filter-listings.js` (kaynak: `scripts/lib/body-style.js`) uzerinden yapilir; ayni kural `parse-car-json.js`'de de kullaniliyor, asla buraya inline kopyalama.

## Adimlar

1. **URL'yi bul.** `src/data/user_data/BOOKMARKS.json` icerisinden `title` alani `mobile.de` ile baslayan kaydi oku. URL'sini al.
2. **Chrome'da yeni sekmede ac.** `mcp__claude-in-chrome__tabs_create_mcp` ile URL'yi yeni sekmede ac. Sayfa yuklenmesini bekle.
3. **Sayfa 1'i tara.** `mcp__claude-in-chrome__javascript_tool` ile sayfadaki ilan kartlarini topla. Kartlar `data-testid` degeri `/^(top|base|tic)-result-listing-\d+$/` ile eslesen container'lardir (`top-` = ust/one cikan, `base-` = normal, `tic-` = ek slot). Her container icin:
   - `id`: container icindeki `a[href*="id="]` (veya `[data-testid$="-link"]`) href'inden `/[?&]id=(\d+)/`. Bulunamazsa kart atlanir. **Not:** Chrome arac ciktisi ham href/URL string'lerini "[BLOCKED: Cookie/query string data]" diye gizler; bu yuzden numeric id'yi JS *icinde* cikar ve geri sadece onu dondur, URL'yi disarida `https://suchen.mobile.de/fahrzeuge/details.html?id=<id>` olarak kur.
   - **Ciktiyi TEK PARCA dondurme.** javascript_tool donusu ~1000 karakterde `[TRUNCATED]` ile kesilir; 24 kartlik JSON array'in yarisi sessizce kaybolur. Toplama JS'i `window.__items`'a yazsin, donus SADECE sayi olsun; sonra boru-ayracli satirlari 8'erli parcalar halinde oku. Tam recete: `.claude/skills/bayi-tara/chrome-liste-cikarma.md` (ortak dosya — buraya kopyalanmaz).
   - `title`: `[data-testid="listing-title-card-view"]` (fallback `[data-testid$="-title"]`) metni.
   - `subTitle`: `[data-testid="listing-details-attributes"]` metni (km / ilk tescil / kW / yakit / "Kazasızlık"/"Onarılmış kaza hasarı" gibi). **Filtreye mutlaka gonder** — body-style ve durum sinyali burada.
   - `price`: `[data-testid="main-price-label"]` (fallback `[data-testid="price-label"]`) metni.
   - `sponsored`: container icinde `[data-testid="sponsored-badge"]` varsa `true`.
   - Sayfa icinde tekrarli ID'leri ele. **Sayfalar arasi da dedupe et:** ayni ilan hem sponsorlu slot (1. sayfa ustu) hem de dogal siralama konumunda (sonraki sayfa) gorunebilir; ID birden cok sayfada cikarsa **sponsorsuz (gercek) gorunumu tercih et** (`sponsored = tum gorunumler sponsorluysa true`).
4. **Filtreyi calistir.** Topladigin satirlari scratchpad'e yaz, node ile `{items:[...]}` JSON'ina cevir ve DOSYADAN ver (uzun icerikte `echo '...'` tirnak kacisi sorunu cikarir):
   ```bash
   node tojson.js "$SP/p1.txt" > "$SP/in.json"
   node scripts/filter-listings.js < "$SP/in.json" > "$SP/out.json"
   ```
   Sayfalar arasi dedupe'u (ayni ID sponsorlu + sponsorsuz gorunum) bu donusturucude yap: `sponsored = tum gorunumler sponsorluysa true`.
   Donusta `{ kept, skipped }` alacaksin.
   - `skipped[i].reason`: `Sponsorlu` / `GranCoupe` / `Cabrio`.
   - `kept[i].status`: `existing` (mobileDeId `src/data/listings/**` icinde zaten var) veya `new`.
   - `kept[i].existingIn`: existing ise hangi dosyada bulundu (orn. `COUPE_GAS_WITH_SUNROOF`, `SOLD`, `KAZALI`, vb.).
   - `kept[i].existingListingId`: existing ise lokal listingId (orn. `C36`).

   **Eleme + existing/new kurallarini kendin yazma — sadece bu CLI'yi cagir.**
5. **Durdurma sinyalini kontrol et.** O ana kadar toplanmis tum sayfalarin `kept` dizisini sirayla birlestir ve sondan basa dogru bak: **son 7 oge `status === 'existing'`** ise dur, sayfa cevirme. Bunun icin sayfa basina degil, kumulatif `kept` listesi uzerinden saymak onemli — sayfa sinirinda da tetiklenebilmeli.
   - Ardisik 7 existing tetiklendiyse → Adim 7'ye gec.
   - Tetiklenmediyse → Adim 6.
6. **Bir sonraki sayfaya gec.** URL'ye `&pageNumber=N` ekleyerek (N=2,3,...) ayni sekmede `mcp__claude-in-chrome__navigate` ile gec. Adim 3-5'i tekrarla.
   - **Guvenlik ust siniri: 10 sayfa.** Bu noktaya gelinmemeli ama gelirse tetiklenmemis olsa bile dur ve raporda "10 sayfa limitine ulasildi, durdurma sinyali tetiklenmedi" notu dus.
   - Sayfada hic ilan yoksa (`cards.length === 0`) dur — son sayfayi gecmissindir.
7. **Yeni ilanlari Apify ile cek.** `kept` icindeki `status === 'new'` ID'lerini topla. Bos degilse, ID'leri **virgulle birlestirip tek tirnakli arguman** olarak ver:
   ```bash
   npm run import:apify -- "id1,id2,id3,...,idN"
   ```
   - **Neden virgullu tek arguman:** ortam shell'i **zsh**; `-- $IDS` gibi tirnaksiz degisken genisletmesi zsh'de word-split OLMAZ, tum ID'ler tek argumana yapisir ve tek gecersiz URL'ye doner. `import-full.js` argumani virgulden boldugu icin tek tirnakli virgullu form her shell'de dogru calisir. (Bosluklu *literal* ID'ler de bolunur ama `$IDS` genisletmesi bolunmez.)
   - Tum yeni ID'leri tek cagrida verebilirsin: `apify-fetch-car.js` URL'leri ic ICinde **≤20'lik parcalara** boler (actor `maxRecords`'u parca basina ayarlanir), her parcayi Apify'dan ceker, ardindan `parse-car-json.js` (sadece bu ID'ler) + `format:data` ile listings'e ekler. **Eskiden tek run 20 kayitla sinirlydi; artik sinir yok.**
   - Komutun ciktisini ozetle: kac parca / kac arac cekildi-eklendi, varsa basarisiz parca. Yeni ID yoksa bu adimi atla.
   - **Uyari:** Yeni ID sayisi cok yuksekse (orn. 50+), import buyuk ve ucretli bir Apify batch'i olur ve cogu re-list (ayni araclarin yeni ID'leri) + tarama aninda yakalanamayan GC/Cabrio cikabilir (asagidaki nota bak). Import oncesi kullaniciyi sayiyla uyar.
8. **Sonuclari sun.** Topladigin tum sayfalarin `kept` listelerini birlestir ve markdown tablo olarak yazdir:

   | # | ID | Durum | Baslik | Fiyat | Link |

   - **Durum** sutunu: `new` ise `🆕 new`, `existing` ise `✅ <existingListingId> (<existingIn>)` (orn. `✅ C36 (COUPE_GAS_WITH_SUNROOF)`).
   - **`existingListingId` her zaman `<BUYUK HARF onek><sayi>` olmali** (C36, W2). `id=445587983` gibi bir sey gorursen bu rapor kusuru DEGIL, agactaki BOZUK KAYITTIR — `npm run lint:data` artik bunu hata veriyor (`scripts/lib/listing-id.js` → `isValidListingId`). Kayda dogru C-serisi ID ver, dosyayi `<listingId>.json` olarak yeniden adlandir, `npm run format:data` calistir. (2026-08-20'de 18 legacy kayit bu sekilde onarildi: C1033-C1050.)
   - Tablonun altinda atlanan kalemleri kisa ozetle: kac sponsorlu, kac GC, kac Cabrio.
   - Ayrica kept icindeki existing/new dagilimini, kac sayfa gezildigini, durdurma nedenini ve adim 7'deki Apify import sonucunu da rapor et (orn. `Sayfa 1-3 gezildi, 12 yeni + 4 existing — 12 yeni ID Apify ile import edildi`).
   - Rapor BIRLESIKTIR: altina adim 9 (refresh) ozeti ve adim 10 (bayi taramasi) tablosu da eklenir — tek mesajda tum dongu gorunur.
9. **Stale ilanlari da yenile (refresh, 2 gun esigi).** Tarama + import bittikten sonra bu adim ATLANMAZ — `refresh` skill'inin (`.claude/skills/refresh/SKILL.md`) TAM akisini, gun esigini **2** yaparak calistir:
   1. `npm run refresh -- 2` (Bash). Ciktida `403` / "Detected a session error" / "veri bulunamadi" / "Batch N hata verdi" basarisizlik sinyalidir.
   2. `node scripts/refresh-stale.js --list 2` ile hala stale kalan (= 403 yiyip cekilemeyen) `mobileDeId`'leri bul. Bos ise bu adim biter, dogrudan rapora gec.
   3. Her basarisiz ID icin `src/data/listings/COUPE_GAS_WITH_SUNROOF/` klasorundeki arac dosyasindan (`grep -rl <id>`) `listingUrl`'i bul, Chrome'da `navigate` + `get_page_text` ile ac: ilan icerigi (fiyat, km) doluysa **gecerli** (dokunma). Sayfa "Bu arac mevcut degil" / bos donuyorsa **HEMEN kayip sayma — CIFT DOGRULAMA ZORUNLU** (C566 vakasi: gec yuklenen sayfa yuzunden canli ilan yanlislikla SOLD'a tasindi): 3-5 sn bekle, sayfayi YENIDEN ac ve tekrar oku; yalnizca ikinci okuma da bos donerse **kayip/satilmis** say.
   4. Kayip tespit edilen ID'ler icin `npm run move:sell -- <mobileDeId>` calistir.
   - **Onay istisnasi:** `refresh` skill'inin manuel calistirilmasinda birden fazla kayip ilan varsa tasimadan once kullaniciya onay sorulur; **bu otomatik loop icinde onay beklenemez** (kimse izlemiyor olabilir) — bu yuzden burada kayip ilanlar dogrudan `move:sell` ile tasinir, onay istenmez. Tasinan her ilan raporda acikca listelenir ki kullanici sonradan gozden gecirebilsin.
   - Rapora ekle: kac ilan stale bulundu, kac tanesi basariyla yenilendi, kac tanesi 403 yedi, 403 yiyenlerden kaci gecerli/kayip, `move:sell` ile SOLD'a tasinanlarin `listingId (mobileDeId)` listesi.
10. **Bayi sitelerini tara.** Bu adim ATLANMAZ — refresh'ten SONRA calisir (mobile.de kayitlari taze olsun ki bayi dedup'u/ikiz tespiti dogru calissin). `.claude/skills/bayi-tara/SKILL.md` icindeki **"Toplu Mod"** akisini uygula: 7 site sirayla (WELLER → TIMMERMANNS → EULER → AHG → BMW_DE → BMW_NL → UNTERBERGER), her site kendi `bayi-tara-<site>` skill'indeki site notlariyla.
    - **Ucuz-gecis kurali:** her sitede once yalniz ARAMA LISTESI taranir ve `filter-listings.js`'e verilir; `new` YOKSA o site icin detay sayfasi/subagent HIC acilmaz (dealerKey listede cozulur). Yeni ilan yoksa bayi fazi dakikalar degil saniyeler surer — 3h loop'ta her turda kosulabilir.
    - **Hata izolasyonu:** bir site bot duvari/timeout ile takilirsa o site raporlanip ATLANIR, kalan siteler devam eder. Ayni siteye 2-3 denemeden fazla ugrasma.
    - **Onay istisnasi (loop icinde):** `possibleTwins` ciktisi icin onay BEKLENMEZ — import yapilir, ikiz suphesi rapora ve karta (`possibleTwinOf`) islenir; kullanici sonradan gozden gecirir.
11. **State dosyasi + session-bound 3h re-scan loop.** Rapor sunulduktan sonra bu adim ATLANMAZ; iki parcasi var:
    1. **State dosyasini yaz:** `logs/last-scan.json` dosyasina tek satir JSON yaz (Write tool):
       `{"finishedAt":"<ISO yerel zaman>","newImported":N,"refreshed":N,"movedToSold":[],"dealerNew":N,"notes":"<varsa onemli not>"}`
       Bu dosya "en son ne zaman tarandi?" sorusunun tek kaynagi — session kopsa bile kalir; SessionStart hook'u da bunu okur.
    2. **Loop'u kur:** `ScheduleWakeup` ile bu taramayi (adim 1-10 dahil) 3 saat sonra tekrar tetikleyecek uyanma kur (dynamic `/loop` modu). Wakeup prompt'una MUTLAKA sunlari yaz: hedef zaman (simdi+3h), pencere kurali, ve "hedef GECMISSE hemen calistir" talimati.
    - **Sadece 09:00–20:00 (yerel saat) araliginda calistir.** Pencere disindaysa hedefi bir sonraki gunun 09:00'ina koy.
    - `ScheduleWakeup` en fazla 3600s kabul eder; 3h'lik araligi tutturmak icin saatte bir yeniden kur (uyaninca `date` + `logs/last-scan.json` kontrol → hedef gecmemis ise kalan sureyle tekrar kur + `noop:true`; hedef gecmis/gelmis ise taramayi calistir).
    - **Gecikme telafisi:** uyanma hedeften SONRA gelirse (uyku/kapali session zinciri geciktirmis olabilir) — pencere aciksa beklemeden HEMEN tara; `last-scan.json` yasi 3 saatten buyukse de ayni sekilde hemen tara.
    - Bu loop **session'a bagli** — session kapaninca biter, `/schedule` ile cloud cron KURMA (Chrome extension'i sadece kullanicinin acik oturumunda calisir). Kopmayi gorunur kilan sey SessionStart hook'udur: yeni/yeniden acilan session'da hook `last-scan.json` yasini basar; yas 3h+ ise kullaniciya "loop kopmus, /mobilede-tara calistir" diye hatirlat (otomatik baslatma — kullanici gorunurde yoksa — YAPMA; hatirlatma yeterli).

## Notlar

- Sadece arama listesini gez — detay sayfalarini ziyaret etme.
- Durdurma kurali: **kept icinde ardisik 7 existing**. Ust sinir 10 sayfa.
- mobile.de bazen cookie / GDPR banner gosterebilir. Banner ilan kartlarini engelliyorsa konsol uzerinden kapat veya `console.log` ile durumu raporla; tekrar tekrar tiklayarak rabbit-hole'a girme — 2-3 denemeden sonra kullaniciya sor.
- Eger filter-listings.js cagrisi kart sayisindan farkli bir toplam donerse, kart toplama JS'inde sponsored bayragini dogru cektigini dogrula.
- **Gövde tipi tarama aninda belirlenemez.** mobile.de arama kartlari hepsine sadece "BMW M440" yazar (sasi kodu / "Gran Coupe" / "Cabrio" govde ipucu yok). Bu yuzden `filter-listings.js` cogu Gran Coupé/Cabrio'yu tarama aninda ELEYEMEZ — COUPE sayip `kept`'e koyar; sadece basligin acikca GC/Cabrio dedigi nadir durumlarda eler. Gercek govde tipi ancak import'ta `parse-car-json` Apify `Category` alanini gorunce belirlenir ve dogru dosyaya (GRAN_COUPE / CABRIO / *_KAZALI / ...) filelanir. Yani "new" cikan ilanlarin onemli kismi aslinda GC/Cabrio olabilir; bunlar import edilince ayri GC/Cabrio dosyalarina gider, hedef Coupé dosyalarina karismaz. Buyuk taramalarda raporda bu dağilimı (kac Coupé / kac GC / kac Cabrio import edildi) belirt.
- **Apify `Category` tek basina govde kaniti DEGIL — `Model range`'e de bak.** C1126 vakasi (2026-08-28): ilan `Category: "Sports Car/Coupe"` derken `Model range: "4-er Gran Coupe"` diyordu; kaba kategori kazandigi icin bir Gran Coupé aylarca COUPE havuzunda durdu ve ancak bayi (UNTERBERGER) sayfasindaki `ANZAHL TÜREN 5 / ANZAHL SITZPLÄTZE 5` satiri sayesinde yakalandi. `body-style.js` artik **Kural 1b** ile model serisindeki acik "Gran Coupe"/"Cabrio" adini `Category`'nin ONUNE koyuyor. Bir aracin gövde tipinden supheleniyorsan sirasiyla: VIN tip kodu (`VIN_TYPE_CODES.json`) → baslik → **Model range** → Category. Kapi/koltuk sayisi 5 ise G22 Coupé olamaz.
- **Kalkan ilan ancak 2 gunluk refresh turunda gorunur — "kacirdik" demeden once dump yasina bak (C40 vakasi, 2026-09-01).**
  Tarama adimlari 1-8 SADECE `new` arar; "bildigim aktif ilan bugunku listede YOK" sinyali hic kullanilmiyor.
  Ilanin kalktigini yalniz adim 9 (refresh) yakalar ve esik 2 gun: son dolu dump'i 31.08 12:09 olan C40
  icin sira 02.09 12:09'da geliyordu, o yuzden 01.09 taramasi "stale yok" derken DOGRU calisiyordu.
  Kullanici "bu neden kacti?" derse once `ls -t dump/<mobileDeId>_*.json | head -1` ile son dump'in
  YASINA bak; 2 gunden gencse gecikme tasarim geregidir, bug degil. Elle teyit icin:
  `node scripts/apify-fetch-car.js <id>` → dump 3 anahtarli `"Listing does not exists anymore"` ise
  `node scripts/parse-car-json.js <id>` otomatik SOLD'a tasir (403'te ise hic dump yazilmaz, karismaz).
  Not: `refresh-stale.js` ozetinde dead dump da "yenilendi" sayilir — rapor yazarken bunu ayirt et.
- **Re-list uyanikligi: ayni arac kapatilip yeni ID ile aciliyor (C729/C1145 vakasi, 2026-09-01).**
  Bayi fiyati indirdigi gun eski ilani kapatip ayni araci yeni mobileDeId ile yeniden yayinlar; boylece
  ilan yasi SIFIRLANIR ve arac "yeni ilan" gorunur (C729: 91 gun, €48.880→€46.450; ayni gun acilan
  C1145: 0 gun, ayni slug/km/tescil/renk/satici). `parse-car-json` bunu `possibleTwinOf` ile isaretler
  ama BIRLESTIRMEZ. Dogru islem: **kok kayit KORUNUR** — eski kaydin `mobileDeId` + `listingUrl` +
  `listingDates` alanlari yeni ilanla guncellenir, audit'e `Yeniden İlan (Re-list)` kaydi (eski→yeni ID,
  fiyat gecmisi, Chrome ile "eski ilan olu" teyidi) yazilir, yeni kayit dosyasi SILINIR.
  Yas korumasi kodda: `src/utils/listingAge.js` → `listingCreatedAt` = min(createdTime, ilk
  "İlan Yayınlandı/İlan Eklendi" audit'i) — createdTime sifirlansa bile gercek yas kalir
  (regresyon testi `src/utils/listingAge.test.js`).
- **Re-list birlestirmesi otomatik ve 3 kanitli: `node scripts/merge-relists.js --dry` → uygula (C853/C1153 + C235/C266 vakasi, 2026-09-01).**
  Import ciktisinda `⚠️ muhtemel ikiz: Cxxx` gorursen loop icinde SORMADAN su siralamayi uygula:
  (1) eski ilani Chrome'da ac ("Bu arac mevcut degil" teyidi), (2) `node scripts/apify-fetch-car.js <eskiId>`
  ile OLU DUMP kanitini yaz (script yalniz dump'a guvenir, Chrome teyidi ona yetmez), (3) `merge-relists.js --dry`
  sonra uygula, (4) `node scripts/parse-car-json.js <yeniId>` ile kok kaydin fiyat/km'sini yeni ilandan esitle
  (merge icerige dokunmaz — C235 €55.900'da kalmis, gercek €54.900'du), (5) `npm run format:data`.
  Kodda duzeltilen 3 tuzak: `scripts/lib/ad-state.js` piyasa karari `newestIsDead`'den verilir (`raw` icerik
  sinyalidir; eski dolu dump yuzunden olu ikiz "alive" sayilip birlestirme sessizce reddediliyordu — C266 bu yuzden
  3.5 ay ayri kayit olarak yasadi), `scripts/lib/merge-relist.js` yeni kaydin audit gecmisini KORUR (fiyat/km
  gecmisi siliniyordu), `src/utils/listingAge.js` re-list sonrasi eski "İlan Satıldı" damgasini yok sayar (arsivden
  canliya donen kok kaydin yas sayaci satis gununde donuyordu). Testler: `ad-state.test.js`, `merge-relist.test.js`,
  `listingAge.test.js`. Arsivden geri donen kok (C235 ← C266) raporda ACIKCA yazilir.
- **Skor ve tablo ayni gun sayisini gostermeli (C45 vakasi, 2026-09-01).** Satilan ilanda yas sayaci
  SATIS tarihinde durur (`carListingAgeDays`); iki ayri formul yazilirsa tablo "10 gunde satildi",
  skor tooltip'i "181 gundur yayinda −20" der. Yas/gun hesabi TEK kaynak: `src/utils/listingAge.js`.
- **Bilinmeyen VIN tip kodu gorursen tabloya ekle.** `VIN_TYPE_CODES.json` yalnizca karsilasilan kodlari icerir; eksik kod sessizce "Kural 0 yok" demektir. C1126'nin VIN'i `WBA11AW0X0FR98053` idi ve `11AW` tabloda yoktu → `11AW = M440i xDrive Gran Coupé (G26)` olarak eklendi (kanit: 5 kapi/5 koltuk + Model range).
