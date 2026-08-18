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
   - `title`: `[data-testid="listing-title-card-view"]` (fallback `[data-testid$="-title"]`) metni.
   - `subTitle`: `[data-testid="listing-details-attributes"]` metni (km / ilk tescil / kW / yakit / "Kazasızlık"/"Onarılmış kaza hasarı" gibi). **Filtreye mutlaka gonder** — body-style ve durum sinyali burada.
   - `price`: `[data-testid="main-price-label"]` (fallback `[data-testid="price-label"]`) metni.
   - `sponsored`: container icinde `[data-testid="sponsored-badge"]` varsa `true`.
   - Sayfa icinde tekrarli ID'leri ele. **Sayfalar arasi da dedupe et:** ayni ilan hem sponsorlu slot (1. sayfa ustu) hem de dogal siralama konumunda (sonraki sayfa) gorunebilir; ID birden cok sayfada cikarsa **sponsorsuz (gercek) gorunumu tercih et** (`sponsored = tum gorunumler sponsorluysa true`).
4. **Filtreyi calistir.** Topladigin diziyi JSON olarak `node scripts/filter-listings.js` komutuna stdin uzerinden ver:
   ```bash
   echo '{"items":[...]}' | node scripts/filter-listings.js
   ```
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
   - Tablonun altinda atlanan kalemleri kisa ozetle: kac sponsorlu, kac GC, kac Cabrio.
   - Ayrica kept icindeki existing/new dagilimini, kac sayfa gezildigini, durdurma nedenini ve adim 7'deki Apify import sonucunu da rapor et (orn. `Sayfa 1-3 gezildi, 12 yeni + 4 existing — 12 yeni ID Apify ile import edildi`).
   - Rapor BIRLESIKTIR: altina adim 9 (refresh) ozeti ve adim 10 (bayi taramasi) tablosu da eklenir — tek mesajda tum dongu gorunur.
9. **Stale ilanlari da yenile (refresh, 2 gun esigi).** Tarama + import bittikten sonra bu adim ATLANMAZ — `refresh` skill'inin (`.claude/skills/refresh/SKILL.md`) TAM akisini, gun esigini **2** yaparak calistir:
   1. `npm run refresh -- 2` (Bash). Ciktida `403` / "Detected a session error" / "veri bulunamadi" / "Batch N hata verdi" basarisizlik sinyalidir.
   2. `node scripts/refresh-stale.js --list 2` ile hala stale kalan (= 403 yiyip cekilemeyen) `mobileDeId`'leri bul. Bos ise bu adim biter, dogrudan rapora gec.
   3. Her basarisiz ID icin `src/data/listings/COUPE_GAS_WITH_SUNROOF/` klasorundeki arac dosyasindan (`grep -rl <id>`) `listingUrl`'i bul, Chrome'da `navigate` + `get_page_text` ile ac: sayfa "Bu arac mevcut degil" / bos donuyorsa **kayip/satilmis**, ilan icerigi (fiyat, km) doluysa **gecerli** (dokunma).
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
