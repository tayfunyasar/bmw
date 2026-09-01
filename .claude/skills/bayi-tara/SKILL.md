---
name: bayi-tara
description: Bayi sitesi crawler'larinin ORTAK akisi — tek basina tetiklenmez; bayi-tara-weller, bayi-tara-ahg gibi site skill'leri bu akisi uygular. Arama listesi Chrome'da taranir, yeni ilanlarin detay sayfalari SUBAGENT'lar ile paralel okunur (her subagent kendi sekmesi), kayitlar `npm run import:dealer` ile src/data/listings/<SITE>/ altina yazilir. TRIGGER - dogrudan tetiklenmez; kullanici "bayi tara", "tum bayileri tara" derse TUM site skill'lerini sirayla calistir.
---

# Bayi Tara — Ortak Akis

Site skill'i (`bayi-tara-<site>`) su bilgileri verir: **SITE adi** (DEALER_SITES.json anahtari), **liste cikarma JS ipuclari**, **sayfalama mekanizmasi**, **detay sayfasi notlari**. Geri kalan her adim burada — site skill'ine KOPYALANMAZ.

Config tek kaynak: `src/data/metadata/DEALER_SITES.json` (idPrefix, detailUrlIdPattern, pageCap, fetchStrategy). Arama URL'si `src/data/user_data/BOOKMARKS.json`'dan `bookmarkTitlePrefix` ile bulunur.

## Adimlar

1. **Arama URL'sini bul.** BOOKMARKS.json'da `title` alani site config'indeki `bookmarkTitlePrefix` ile baslayan kaydi oku.

2. **Arama listesini tara (ana oturum).** `mcp__claude-in-chrome__navigate` ile ac (mevcut sekme kullanilabilir), `mcp__claude-in-chrome__javascript_tool` ile kartlari topla. Site skill'indeki selector ipuclarini kullan. Her kart icin en az: `id` (site-ici, detailUrlIdPattern capture'i), `path` (detay URL yolu), `subTitle` (govde/durum sinyali icin), `price`, `reg`.
   - **Tarayici cikti mekanigi ORTAK dosyada:** `chrome-liste-cikarma.md` (bu skill dizininde) — kirpma (~1000 kr), redaksiyon, parcali okuma, kart container'i ata tirmanisi + uzunluk freni. Site skill'ine kopyalanmaz, oradan okunur.
   - Sayfalama: site skill'indeki mekanizmayla (buton/param) `pageCap`'e kadar; sayfada yeni kart cikmayinca dur.

3. **Existing/new ayrimi.** Toplanan kartlari stdin ile filtreye ver — id alanini SADECE mobile.de numerik id'siyse doldur; site-ici ID'ler `url` uzerinden dealerKey'e gider:
   ```bash
   echo '{"site":"<SITE>","items":[{"url":"<tam detay URL>","title":"...","subTitle":"...","price":"..."}]}' | node scripts/filter-listings.js
   ```
   `kept[].status === 'new'` olanlarin detayi acilir. `skipped` (GranCoupe/Cabrio) v1'de detaya ACILMAZ — rapor tablosunda sayilir. (Havuzun hedefi coupe; GC/Cabrio bayi kayitlari istenirse sonra acilir.)
   - **Kapsam kurali (API kisa yollarinda kritik):** `filter-listings.js` govde/dedup eler, SAYISAL kapsami (km / yil / fiyat tavani) ELEMEZ — o kapsam BOOKMARK'ta tanimlidir. Sitenin kendi filtresini atlayan bir kisa yol kullandiysan (EULER/WELLER API'leri gibi) bookmark limitlerini **yerel olarak yeniden uygula**, yoksa kapsam disi arac "yeni" gorunur ve gereksiz import edilir. Yasanmis vaka: EULER API'sinde `km_max` token'i gecersiz oldugu icin 89.535 km'lik arac (bookmark ≤50K) "new" dondu — import EDILMEDI, raporda kapsam disi olarak not dusuldu. Kapsam disi biraktigin her kaydi raporda ACIKCA yaz (sessizce atma).

4. **Detay sayfalarini SUBAGENT'larla paralel oku.** `new` URL'leri 3-5'erli gruplara bol; her grup icin TEK MESAJDA birden fazla `general-purpose` subagent baslat. Subagent prompt sablonu (pilotta dogrulandi):

   > You are a car-listing detail-page scraper. Chrome MCP tools may be deferred — load in ONE ToolSearch call: "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__tabs_close_mcp".
   > TASK: For EACH of these URLs: <URL listesi>. Open in a NEW Chrome tab (tabs_context_mcp once, then tabs_create_mcp for YOUR OWN tab, navigate that tabId). get_page_text; if incomplete retry once. Close YOUR tab when done. Do not touch other tabs. If a cookie/GDPR banner blocks content, do NOT accept it — report "BANNER_BLOCKED" in notes.
   > Return ONLY a JSON array, one object per URL:
   > `{ "dealerId": "<id>", "title": "...", "attributes": { "Category": "<Karosserie: Coupé | Gran Coupé | Cabrio / Roadster — sayfadaki govde alanindan>" }, "description": "<TUM donanim listesi, verbatim Almanca, newline ayrik — EN ONEMLI ALAN>", "features": [], "properties": { "milage": "...", "firstRegistration": "MM/YYYY", "upholstery": "...", "colour": "...", "manufacturerColour": "...", "co2Emission": "... g/km", "generalInspection": null, "numberOfOwners": null, "fuelType": "Petrol" }, "price": { "amount": <int> }, "dealer": { "name": "<sube>", "contry": "<DE|NL|AT>", "addesses": ["<sokak>", "<PLZ Sehir>"] }, "vin": "<Fahrgestellnummer varsa, yoksa null>", "mobileDeUrl": "<sayfada mobile.de linki varsa>", "notes": "<tuhafliklar>" }`
   > Numbers as integers. Missing field = null. Do NOT invent values.

   - **attributes.Category SART** — URL slug'i yalanci olabilir (WELLER'da "sportwagen-coupe" slug'lu Cabrio goruldu); routing bu alani okur.
   - Subagent donusunde `dealerListingUrl`'i SEN ekle (URL'ler sende — redaction'a takilmaz).

5. **Import.** Tum kayitlari birlestirip:
   ```bash
   node scripts/import-dealer.js --dry-run < kayitlar.json   # once kontrol
   node scripts/import-dealer.js < kayitlar.json             # sonra yaz
   npm run format:data
   ```
   stdin dosyasini scratchpad'e yaz (`echo` ile tek satir JSON'dan kacin — kayitlar buyuk).
   - `possibleTwins` raporunu MUTLAKA kullaniciya goster: VIN'siz mobile.de kaydinin fiziksel ikizi olabilir (W1≈C264 vakasi).
   - Dedup otomatik: mobileDeId → vin → dealerKey. Kok dosyada eslesen kayit site dosyasina YAZILMAZ (`existing` raporlanir).

6. **Rapor.** Markdown tablo: `| # | dealerKey | Durum | Baslik | Fiyat | Kategori |` — `🆕 W3 (WELLER/COUPE_GAS_WITH_SUNROOF)` / `✅ C264 (existing)` / `⚠️ possibleTwin`. Altina: kac sayfa, kac skipped (GC/Cabrio), kac subagent, banner/hata notlari.

## Toplu Mod (tum siteler — mobilede-tara adim 10 buradan cagirir)

Sira: **WELLER → TIMMERMANNS → EULER → AHG → BMW_DE → BMW_NL → UNTERBERGER** (kolay/hizlidan agir SPA'ya). Her site icin kendi `bayi-tara-<site>` skill'inin Site Notlari gecerli; akis yine bu dosya.

- **Ucuz-gecis:** once yalniz liste taramasi + filter; `new` yoksa detay/subagent ACILMAZ, siradaki siteye gec. Boylece yeni ilan olmayan turlar saniyeler surer.
- **Hata izolasyonu:** bot duvari/timeout'ta site raporlanip atlanir; kalanlar devam. Site basina en fazla 2-3 deneme.
- **Loop onay istisnasi:** otomatik dongude (mobilede-tara loop'u) possibleTwins icin onay beklenmez — import edilir, ikiz karta islenir, raporda listelenir.
- Tum sitelerin sonuclari TEK birlesik tabloda raporlanir: `| Site | Yeni | Mevcut | Ikiz | Atlanan(GC/Cabrio) | Not |`.

## Notlar

- **Eleme + existing/new + normalize + route + ID uretimi = paylasilan modullerde.** Skill'e mantik yazma; CLI'lari cagir (mobilede-tara ile ayni ilke).
- Cookie/GDPR banner: en gizlilik-dostu secenek; kabul GEREKIYORSA kullaniciya sor. 2-3 denemede gecilemiyorsa rapor et, rabbit-hole'a girme.
- Bot duvari (Cloudflare/CAPTCHA) cikarsa o siteyi raporla ve ATLA — asma girisiminde bulunma.
- **KURAL: dil kalibi/esik/liste SKILL'E YAZILMAZ, config'e yazilir.** Bir siteye ozgu yazim varyanti
  bulursan onu skill notu yapma — tek kaynak JSON'a ekle: donanim `EQUIPMENT_RULES.json`,
  tahrik/hasar/marj-KDV `TEXT_SIGNALS.json` (`drivetrain.awdWords|rwdWords`, `damage.words|negationWords|majorSellers`,
  `vat.marginWords`), gövde `VIN_TYPE_CODES.json` + `body-style.js`. Karari KOD verir
  (`drivetrain.js`, `route-listing.js`, `equipment-match.js`, `import-dealer.js`); subagent yalnizca
  HAM METNI dogru alana tasir. Kalip eklerken regresyon testi zorunlu
  (`text-signals.test.js` / `equipment-rules.test.js`). Skill'de kalip listesi gormek = drift borcu (2026-09-01
  BMW_NL refactoru: Flemenkce kaliplar skill'den `TEXT_SIGNALS.json`'a tasindi).
- Bayi Almancasi mobile.de'den farkli kaliplar kullanir. Eslesmeyen onemli donanim gorursen EQUIPMENT_RULES.json'a kalip ekle ve import'u tekrar calistir — guncelleme idempotenttir. **DIKKAT — paket parcasi ≠ paket:** bir PAKETIN alt ozelligini paketin kaniti sayan kalip YAZMA. Ornek vaka (2026-08-20 duzeltildi): "Aktive Geschwindigkeitsregelung mit Stop & Go" (= sadece ACC) S5AUA/DAP kaniti sayilmisti; 250 aracta sahte "Driving Assistant Professional: var" uretti. Kalip yalnizca donanimin ACIK ADINI eslestirmeli.
- **Collapsed "..." bolumleri: donanim listesini almadan once GENISLET (tikla).** Genisletilemiyorsa liste EKSIKTIR: notes'a "donanim listesi eksik (collapsed)" yaz ve raporda belirt. Eksik listeden turetilen "yok" degerleri roota SAHTE equipmentConflicts yazdirir — C264 vakasi (2026-08-20): eksik WELLER listesi 10 sahte celiski uretti, canli sayfa tam listeyle hepsini curuttu. Bir kayitta cok sayida "mobile.de=yes / SITE=no" celiskisi gorursen once taramanin listeyi tam alip almadigindan suphelen.
- VIN cogu sitede yazmaz; varsa MUTLAKA al (tahrik Kural 0 + dedup icin altin degerinde).
- **Bayi hasar beyani kok kaydi KAZALI'ya tasir — merge tek basina YETMEZ.** `mergeTwinIntoRoot`
  bayinin "Unfallvorschaden: Ja" beyanini kok kayda `dealerReportedDamage` olarak yazar, ama
  `determineTargetFile` yalniz YENI kayitlar icin calistigi icin dosya temiz havuzda KALIYORDU.
  2026-08-24 vakasi (C1080): BMW.de ilani Unfallvorschaden: Ja dedi, sinyal yazildi, dosya yine
  COUPE_GAS_WITHOUT_SUNROOF'ta kaldi. Duzeltme: `import-dealer.js` merge sonrasi
  `rerouteKazaliAfterMerge` (scripts/lib/move-listing.js) cagiriyor ve raporda `rerouted[]`
  aliyorsun. Import ciktisinda `rerouted` GORURSEN raporda ACIKCA yaz.
- **Subagent `properties.milage`'i sayi dondurebilir.** Bayi kayitlari bizim disimizda uretilir;
  `parse-listing.js` artik hem `"43.541 km"` hem `43541` kabul eder (`String(...)` ile). Ayni
  vakada import `replace is not a function` ile cokmustu — yeni bir alan sayi/string ikilemi
  yasatirsa duzeltme parse katmaninda yapilir, subagent prompt'unda DEGIL.
- **Ayni fiziksel arac 3 ilanda birden cikabilir** (mobile.de x2 + bayi sitesi). Ayirt edici anahtar
  **Angebotsnummer**: BMW.de ile bayinin kendi sitesi ayni teklif numarasini tasir, biri VIN'i
  digeri hasar beyanini verir. `findTwin` ilk eslesen kaydi doner (kategori alfabetik sirasi) —
  yani ikizlerden HANGISINE merge oldugu keyfidir. Merge raporundaki `listingId`'yi gozle dogrula;
  ikiz cift kaldiysa ikisini de dogru kategoriye tasi ve raporda cift olarak listele.
