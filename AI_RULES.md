# Core AI Agent Rules

## 1. Architectural Integrity & DRY Principle
- **Absolute Prohibition of Duplication:** Code and logic must never be duplicated across multiple locations.
- **Mandatory Extraction:** Any element intended for multiple uses must be extracted into a shared module and imported accordingly.

## 2. Modification Rules
- **Structural Over Speed:** Prioritize modularity and long-term maintainability over short-term implementation.
- **Component Integrity:** Extracted components must be self-contained and independently functional.

## 3. Proje Kuralları (eski memory'lerden, 2026-08-20)
- **Bayi linki akışı:** Kullanıcı bir listing ID + bayi URL'si verdiğinde sormadan `/bayi-linki` akışını çalıştır (dealerListingUrl ekle, sayfayı tara, unknown donanımları çöz, audit + `format:data`).
- **Büyük tarama tuzakları:** mobile.de arama kartları gövde tipini göstermediği için taramada GC/Cabrio elenemez (büyük "new" sayısı büyük olasılıkla re-list + gizli GC/Cabrio — import öncesi kullanıcıyı uyar) ve zsh'de `import:apify` ID'leri daima virgüllü TEK tırnaklı argüman olarak verilir (`-- "id1,id2,..."`).
- **3 saatlik tarama loop'u:** Her `/mobilede-tara` sonrası oturuma bağlı, 3 saatte bir (yalnız 09:00–20:00 lokal) kendini tekrarlayan tarama loop'u kur — skill'in 9-10. adımları; 2 gün eşikli tam refresh akışı dahil, loop'un otomatik SOLD'a taşıdığı her ilan raporda açıkça listelenir.
- **Kanıt yoksa etiketleme:** Emsal/örüntü kanıt değildir — ÇAKAL/kazalı gibi bir etiket için ham veride doğrudan sinyal göster, anomalide önce kendi sınıflandırıcımızdan şüphelen; "açıklama her şeyi ezer" (ilan metni > checkbox) duran kuraldır ve elle girilmiş standart-dışı değerler toplu migration'da korunur.
- **Apify ID eşlemesi:** `import:apify` çıktısındaki Cxxx sırası girdi ID sırasıyla eşleşmez — listingId↔mobileDeId eşlemesini raporlamadan önce listings dosyalarından grep ile doğrula.
- **Config-driven mimari:** Tüm saf veri domain-adlı JSON dosyalarında tutulur (kodda gömülü tablo/sabit yok; dil kalıpları/kelime listeleri `TEXT_SIGNALS.json` + `EQUIPMENT_RULES.json` — SKILL.md'ye kalıp yazmak yasak, skill yalnız süreç anlatır), normalize/fuzzy resolver yerine düz exact-key lookup kullanılır, türev/legend değişkeni yazılmaz; değişiklik PR'sız localde yapılır ve Chrome MCP ile dev sunucuda gözle doğrulanır.
- **Ham veri göster:** UI ham dump verisini gösterir — renk değerleri birleşik/concat (ham üretici etiketi `exteriorPaintLabel`'da), konum ham adres satırı, kırpma/dönüştürme yok; yeni ham alan `LISTING_FILES.json rootKeysOrder`'a eklenir, yoksa `format:data` onu siler.
- **Basit tut, az soru sor:** Küçük/net istekte mevcut yapıyı koruyup yalnız isteneni yap, art arda soru sorma; öneri paneli ve tablolar AYNI filtreli havuzu kullanır (tutarlılık: öneride görünen araç tabloda da olmalı).
- **Kök neden = 3 katman (BİTTİ tanımı):** Her hata düzeltmesi/bulgusu sorulmadan üç katmanda biter ve
  üçü de AYNI turda yapılır — kullanıcı hatırlatmaz, onay beklenmez:
  1. **Veri:** kaydı onar + `grep`/script ile aynı desendeki TÜM kayıtları tara ve onları da onar.
  2. **Kod:** hatayı üreten kural/kodu düzelt + regresyon testi ekle (`npm test` yeşil).
     Test edilebilmesi için gerekiyorsa saf fonksiyonu bağımsız modüle çıkar (`src/utils/listingAge.js` örneği).
  3. **Ders:** ilgili `SKILL.md`'ye vaka referanslı (ID + tarih) madde yaz; skill yoksa bu dosyaya.
  Üç artefakt (değişen veri dosyaları · test adı · SKILL.md satırı) raporda ADLARIYLA listelenmeden iş
  "tamam" sayılmaz. Bir düzeltmenin devamı niteliğindeki temizlik (ör. aynı desendeki diğer ikizleri
  birleştirmek) de sorulmadan yapılır — "yapayım mı?" diye sormak bu kuralın ihlalidir.
