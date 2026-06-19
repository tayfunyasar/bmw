---
name: mobilede-tara
description: BOOKMARKS.json icindeki mobile.de M440i/M440d arama linkini Chrome'da acar, yeni ilanlari sponsorlu/Gran Coupe/Cabrio eleyerek existing/new durumuyla tarar. Ardisik 7 existing gorunce durur (ust sinir 10 sayfa), yeni ID'leri `npm run import:apify` ile ceker. TRIGGER - kullanici "mobilede tara", "mobile.de tara", "mobile de tara", "yeni ilan tara", "yeni ilanlari tara", "mobilede yeni ilan var mi", "tarama yap", "/mobilede-tara" yazdiginda — slash olsun olmasin, bu cumlelerden biri gectiginde DOGRUDAN bu skill'i calistir, kullaniciya secenek sunma.
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
   - `kept[i].status`: `existing` (mobileDeId `src/data/listings/*.json` icinde zaten var) veya `new`.
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

## Notlar

- Sadece arama listesini gez — detay sayfalarini ziyaret etme.
- Durdurma kurali: **kept icinde ardisik 7 existing**. Ust sinir 10 sayfa.
- mobile.de bazen cookie / GDPR banner gosterebilir. Banner ilan kartlarini engelliyorsa konsol uzerinden kapat veya `console.log` ile durumu raporla; tekrar tekrar tiklayarak rabbit-hole'a girme — 2-3 denemeden sonra kullaniciya sor.
- Eger filter-listings.js cagrisi kart sayisindan farkli bir toplam donerse, kart toplama JS'inde sponsored bayragini dogru cektigini dogrula.
- **Gövde tipi tarama aninda belirlenemez.** mobile.de arama kartlari hepsine sadece "BMW M440" yazar (sasi kodu / "Gran Coupe" / "Cabrio" govde ipucu yok). Bu yuzden `filter-listings.js` cogu Gran Coupé/Cabrio'yu tarama aninda ELEYEMEZ — COUPE sayip `kept`'e koyar; sadece basligin acikca GC/Cabrio dedigi nadir durumlarda eler. Gercek govde tipi ancak import'ta `parse-car-json` Apify `Category` alanini gorunce belirlenir ve dogru dosyaya (GRAN_COUPE / CABRIO / *_KAZALI / ...) filelanir. Yani "new" cikan ilanlarin onemli kismi aslinda GC/Cabrio olabilir; bunlar import edilince ayri GC/Cabrio dosyalarina gider, hedef Coupé dosyalarina karismaz. Buyuk taramalarda raporda bu dağilimı (kac Coupé / kac GC / kac Cabrio import edildi) belirt.
