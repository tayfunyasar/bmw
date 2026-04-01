---
name: import-mobile-listing
description: mobile.de araç ilanlarını projenin veri yapısına (JSON) uygun şekilde import eder. Kullanıcı bir link verdiğinde bu skill'i kullanarak verileri çeker veya manuel girişle düzenler.
---

# Import Mobile Listing

## Genel Bakış

Bu skill, mobile.de'den alınan araç verilerini `src/data/listings/` altındaki `withSunRoot.json`, `noSunRoot.json` veya `soldListings.json` dosyalarına, projenin `enforce-listings.js` kurallarına uygun şekilde ekler.

## İş Akışı

### 1. Veri Çıkarma (Crawl veya Manuel)
Link verildiğinde önce script'i çalıştırın:
```bash
node .ai/skills/import-mobile-listing/scripts/crawl.cjs <URL>
```
**Dikkat:** mobile.de botları blokluyorsa (403), kullanıcıdan ilan başlığını, fiyatını, km'sini ve özelliklerini (copy-paste) isteyin.

### 2. Şema Eşleme (Mapping)
Verileri `enforce-listings.js` içindeki `ROOT_KEYS_ORDER` ve `EQUIP_KEYS_ORDER` sıralamasına göre hazırlayın.

**Zorunlu Alanlar ve Varsayılanlar:**
- `listingId`: "C" + benzersiz bir sayı (dosyadaki son numarayı kontrol edin).
- `estimatedImportTaxEuro`: Eğer kullanıcı belirtmemişse ve 2021 modelse, `pricingCalculator.js`'e göre tahmini bir değer (ör. 4112) girin veya 0 bırakın.
- `equipmentFeatures`: Tüm anahtarlar (Sunroof, Harman Kardon vb.) bulunmalı. Değerler: "yes", "no", "unknown".
- `cardThemeColorHex`: Renk seçimine göre (ör. Portimao Blue için #22d3ee, Beyaz için #e2e8f0).

### 3. Kayıt ve Format
Veriyi ilgili JSON'a (genellikle `withSunRoot.json`) ekledikten sonra mutlaka:
```bash
npm run format:data
```
komutunu çalıştırarak alanların sırasını ve formatting'i otomatik düzeltin.

## Örnek Veri Yapısı (Sıralı)
```json
{
  "listingId": "C100",
  "listingUrl": "...",
  "exteriorColorName": "Portimao Blue",
  "interiorColorName": "Deri Siyah",
  "drivetrainType": "xDrive AWD",
  "basePriceEuro": 45000,
  "estimatedImportTaxEuro": 4112,
  "mileageKm": 35000,
  "firstRegistrationYearAndMonth": [2022, 5],
  "numberOfPreviousOwners": "1",
  "warranty": {
    "exists": "yes"
  },
  "service": {
    "type": "yes",
    "history": []
  },
  "nextInspectionDate": "05/2026",
  "sellerTypeOrName": "Bayi",
  "modelGeneration": "Pre-LCI",
  "co2EmissionsGramPerKm": 152,
  "listingLocation": "🇩🇪 Münih",
  "curatorPickBadge": null,
  "curatorPersonalNotes": [],
  "listingDescriptionNotes": [],
  "listingAdditionalFeatures": ["M Sportpaket Pro (~€1,500)", "EGO-X Abgasanlage (~€3,500 - Aftermarket)"],
  "equipmentFeatures": { ... tüm özellikler ... },
  "auditHistory": [
    {
      "action": "İlan Eklendi",
      "detail": "Sistem tarafından kayıt altına alındı",
      "changes": null,
      "auditDate": "2026-03-31T12:00:00.000Z"
    }
  ],
  "cardThemeColorHex": "#22d3ee"
}

## Ekstra Özellikler (listingAdditionalFeatures)
**ÖNEMLİ:** `listingAdditionalFeatures` (Ek Özellikler) alanına YALNIZCA araca ait özel donanım ve modifiyeleri (Özel renk, Jant, Aftermarket Egzoz, M Sport Paket vb.) girin. 
Buraya genel notları, kaza durumlarını veya "Sunroof Yok" gibi eksiklikleri KESİNLİKLE yazmayın (bu tür bilgileri `listingDescriptionNotes` kısmına taşıyın).

**KURAL:** `listingAdditionalFeatures` dizisine eklediğiniz HER bir donanım öğesinin yanına **MUTLAKA** tahmini fiyatını parantez içinde yazın. Eğer bir Aftermarket modifikasyonu varsa, bunu da sonuna "- Aftermarket" olarak ekleyin (Çünkü sistem bu kelimeyi arayarak araca -2 puan risk cezası verecektir).

**Örnek formatlar:** 
- `"19\" M Jantlar (~€1,000)"`
- `"EGO-X Abgasanlage (~€3,500 - Aftermarket)"`
- `"M Sportpaket Pro (~€1,500)"`
- `"Individual Dravitgrau (~€1,500)"`

```
