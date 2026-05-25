---
name: bayi-linki
description: Bir ilana bayi websitesi linki ekle, sayfayi tarayip equipment unknown'larini cozumle. TRIGGER - kullanici bir listing ID (orn. C174) ile birlikte bir bayi/dealer URL'si verdiginde ("C174 bayi linki: https://...", "/bayi-linki C174 <url>", "<url> C174'un bayi sayfasi" vb.) DOGRUDAN bu skill'i calistir.
---

# Bayi Linki (Dealer Listing URL)

Kullanici bir listing ID ve bayi websitesi linki verdiginde:

## Adimlar

1. **Ilani bul** — Verilen listing ID'yi (ornegin C174) `src/data/listings/` JSON dosyalarinda grep ile bul.
2. **`dealerListingUrl` ekle** — Ilana `dealerListingUrl` alanini ekle (listingUrl'den sonra, mobileDeId'den once).
3. **Bayi sayfasini tara** — WebFetch ile linkteki tum arac ozelliklerini/donanimlarini cek (Almanca orijinal metin).
4. **Equipment kodlarini esle** — `src/data/metadata/EQUIPMENT_RULES.json` dosyasindaki kod-ozellik eslesmesini kullanarak, bayi sitesindeki ozellikleri equipment kodlarina maple.
5. **Unknown'lari cozumle** — Sadece "unknown" olan equipmentFeatures degerlerini guncelle:
   - Bayi sitesinde acikca listelenen ozellikler → "yes"
   - Bayi sitesinde listelenmeyip, kesin olarak olmadigi anlasilabilenler → "no" (ornegin Sunroof WITHOUT_SUNROOF dosyasindaysa, veya basic Driving Assistant varsa Professional degil)
   - Belirsiz olanlar → "unknown" olarak kalsin
6. **Audit history ekle** — Yapilan degisiklikleri audit history'ye kaydet:
   ```json
   {
     "action": "Bayi Sitesinden Donanim Guncellendi",
     "detail": "<domain> bayi sitesinden donanim bilgileri cekildi. <degisiklikler>",
     "changes": { "KOD": "unknown→yes/no", ... },
     "auditDate": "<ISO tarih>"
   }
   ```
7. **Format calistir** — `npm run format:data` ile dogrulamayi calistir.

## Kullanim

```
/bayi-linki C174 https://example.de/fahrzeug/123
```

Veya kullanici serbest metin olarak "C174'e ait bayi linki: https://..." seklinde de verebilir.
