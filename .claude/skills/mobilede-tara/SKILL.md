---
name: mobilede-tara
description: BOOKMARKS.json icindeki mobile.de M440i/M440d arama linkini Chrome'da acar, yeni ilanlari sponsorlu/Gran Coupe/Cabrio eleyerek existing/new durumuyla tarar. Ardisik 5 existing gorunce durur (ust sinir 10 sayfa), yeni ID'leri `npm run import:apify` ile ceker. TRIGGER - kullanici "mobilede tara", "mobile.de tara", "mobile de tara", "yeni ilan tara", "yeni ilanlari tara", "mobilede yeni ilan var mi", "tarama yap", "/mobilede-tara" yazdiginda — slash olsun olmasin, bu cumlelerden biri gectiginde DOGRUDAN bu skill'i calistir, kullaniciya secenek sunma.
---

# mobile.de Tara

Kullanici `/mobilede-tara` dedigi zaman: BOOKMARKS.json icindeki "mobile.de — M440i/M440d xDrive ..." linkini Chrome'da yeni bir sekmede ac. Sayfa sayfa ilan topla; **kept (filtreden gecmis) listede ardisik 5 existing** gorduktan sonra dur. Sponsorlu reklamlari ve Gran Coupé / Cabrio araclari listeleme — bu eleme `scripts/filter-listings.js` (kaynak: `scripts/lib/body-style.js`) uzerinden yapilir; ayni kural `parse-car-json.js`'de de kullaniliyor, asla buraya inline kopyalama.

## Adimlar

1. **URL'yi bul.** `src/data/user_data/BOOKMARKS.json` icerisinden `title` alani `mobile.de` ile baslayan kaydi oku. URL'sini al.
2. **Chrome'da yeni sekmede ac.** `mcp__claude-in-chrome__tabs_create_mcp` ile URL'yi yeni sekmede ac. Sayfa yuklenmesini bekle.
3. **Sayfa 1'i tara.** `mcp__claude-in-chrome__javascript_tool` ile sayfadaki ilan kartlarini topla. Her kart icin asagidaki alanlari cikar:
   - `id`: `<a href>` icindeki `id=...` (regex: `/[?&]id=(\d+)/`). Bulunamazsa kart atlanir.
   - `title`: `[data-testid="listing-title-list-view"]` icindeki metin (veya `title` attribute).
   - `sponsored`: kartta `[data-testid="sponsored-badge"]` veya `.sponsoredBadge_SponsoredBadge__DI71D` varsa `true`.
   - `price`: kartin fiyat alani (varsa, ham metin).
   - `url`: detay linki (mobile.de'de detay URL'si).
   - Tekrarli ID'leri ele.
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
5. **Durdurma sinyalini kontrol et.** O ana kadar toplanmis tum sayfalarin `kept` dizisini sirayla birlestir ve sondan basa dogru bak: **son 5 oge `status === 'existing'`** ise dur, sayfa cevirme. Bunun icin sayfa basina degil, kumulatif `kept` listesi uzerinden saymak onemli — sayfa sinirinda da tetiklenebilmeli.
   - Ardisik 5 existing tetiklendiyse → Adim 7'ye gec.
   - Tetiklenmediyse → Adim 6.
6. **Bir sonraki sayfaya gec.** URL'ye `&pageNumber=N` ekleyerek (N=2,3,...) ayni sekmede `mcp__claude-in-chrome__navigate` ile gec. Adim 3-5'i tekrarla.
   - **Guvenlik ust siniri: 10 sayfa.** Bu noktaya gelinmemeli ama gelirse tetiklenmemis olsa bile dur ve raporda "10 sayfa limitine ulasildi, durdurma sinyali tetiklenmedi" notu dus.
   - Sayfada hic ilan yoksa (`cards.length === 0`) dur — son sayfayi gecmissindir.
7. **Yeni ilanlari Apify ile cek.** `kept` icindeki `status === 'new'` ID'lerini topla. Bos degilse:
   ```bash
   npm run import:apify -- "<id1>" "<id2>" ... "<idN>"
   ```
   Tum yeni ID'leri tek seferde ver — script Apify'a paralel olarak fetch eder, ardindan `parse-car-json.js` + `format:data` ile veriyi listings'e ekler. Komutun ciktisini ozetle (basarili/basarisiz sayisi). Yeni ID yoksa bu adimi atla.
8. **Sonuclari sun.** Topladigin tum sayfalarin `kept` listelerini birlestir ve markdown tablo olarak yazdir:

   | # | ID | Durum | Baslik | Fiyat | Link |

   - **Durum** sutunu: `new` ise `🆕 new`, `existing` ise `✅ <existingListingId> (<existingIn>)` (orn. `✅ C36 (COUPE_GAS_WITH_SUNROOF)`).
   - Tablonun altinda atlanan kalemleri kisa ozetle: kac sponsorlu, kac GC, kac Cabrio.
   - Ayrica kept icindeki existing/new dagilimini, kac sayfa gezildigini, durdurma nedenini ve adim 7'deki Apify import sonucunu da rapor et (orn. `Sayfa 1-3 gezildi, 12 yeni + 4 existing — 12 yeni ID Apify ile import edildi`).

## Notlar

- Sadece arama listesini gez — detay sayfalarini ziyaret etme.
- Durdurma kurali: **kept icinde ardisik 5 existing**. Ust sinir 10 sayfa.
- mobile.de bazen cookie / GDPR banner gosterebilir. Banner ilan kartlarini engelliyorsa konsol uzerinden kapat veya `console.log` ile durumu raporla; tekrar tekrar tiklayarak rabbit-hole'a girme — 2-3 denemeden sonra kullaniciya sor.
- Eger filter-listings.js cagrisi kart sayisindan farkli bir toplam donerse, kart toplama JS'inde sponsored bayragini dogru cektigini dogrula.
