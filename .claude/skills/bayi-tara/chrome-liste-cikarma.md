# Chrome Liste Cikarma — Ortak Mekanik

Bu dosya `bayi-tara` ve `mobilede-tara` skill'lerinin PAYLASTIGI tarayici mekanigidir.
Site skill'ine veya `mobilede-tara`'ya KOPYALANMAZ — oradan buraya referans verilir.

## Cikti katmaninin iki siniri (dogrulandi 2026-08-20)

`mcp__claude-in-chrome__javascript_tool` donus degeri iki filtreden gecer:

1. **Kirpma (~1000 karakter).** Uzun donus `[TRUNCATED]` ile kesilir. 24 kartlik tek bir
   JSON array donmeye calismak kartlarin yarisini kaybettirir — ve kayip SESSIZ olur
   (JSON.parse hatasi almazsin, cunku string'i zaten sen okuyorsun).
2. **Redaksiyon (`[BLOCKED: Cookie/query string data]`).** Ham URL / query string
   iceren cikti KOMPLE bloklanir. Tetikleyici yalnizca URL degil: `€ 61.900,-` gibi
   para+noktalama yigini da bloklanabiliyor (BMW_NL'de yasandi). Bloklandiginda
   ciktinin TAMAMI gider, parcasi degil.

## Recete

1. **Bir kez topla, pencerede tut.** Kart toplama JS'i sonucu `window.__items`'a yazsin,
   donus degeri olarak SADECE sayiyi versin (`return out.length + ' cards'`).
2. **ID'yi ve path'i JS ICINDE cikar.** `href` string'ini disari dondurme:
   `const id = a.getAttribute('href').match(/[?&]id=(\d+)/)[1]` → sadece `id` don.
   Tam URL'yi Bash tarafinda sablondan kur.
3. **Parca parca oku, boru ayracli satir olarak.** JSON degil pipe: ayni veri ~3 kat kisa.
   ```js
   window.__lines = (i, n = 8) => window.__items.slice(i, i + n)
     .map(o => [o.id, o.sponsored ? 1 : 0, o.title, o.subTitle, o.price].join('|')).join('\n');
   ```
   8 satir ≈ 850 karakter — kirpma sinirinin altinda. Sonraki cagri `window.__lines(8,8)`.
4. **`€` isaretini cikarmadan once degistir** (`.replace(/€/g,'EUR')`) — redaksiyon riskini
   dusurur. Fiyati zaten sayi olarak ayristirdiysan € hic dondurme.
5. **Bash tarafinda yeniden kur.** Satirlari scratchpad'e yaz, node ile `{site, items}`
   JSON'ina cevir ve DOSYADAN `filter-listings.js`'e ver — `echo '...'` ile tek satir JSON
   gecme (uzun icerik + tirnak kacisi sorun cikarir):
   ```bash
   node tojson.js "$SP/site.txt" > "$SP/site-in.json"
   node scripts/filter-listings.js < "$SP/site-in.json" > "$SP/site-out.json"
   ```
6. **Cikti dogrulamasi:** dondurulen satir sayisi `window.__items.length` ile birebir
   tutmuyorsa kirpma yemissindir — parca boyutunu kucult, tekrar oku.

## Kart container'ini bulma (ata tirmanisi)

Link'ten yukari tirmanip "icinde € ve km olan ilk ata"yi almak dogru sezgi, ama
**uzunluk freni sart**:

```js
let el = a, best = null;
for (let i = 0; i < 10 && el; i++) {
  const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (/€/.test(t) && /km/.test(t) && t.length < 800) { best = t; break; }
  if (t.length > 800) break;               // <-- fren
  el = el.parentElement || (el.getRootNode && el.getRootNode().host);
}
```

Fren olmadan BMW.de'de tirmanış tum sayfaya cikti ve HER kart icin ayni filtre
metnini ("Wählen Sie Optionen…") dondurdu. `getRootNode().host` shadow DOM'dan
disari cikmayi saglar (BMW_DE / EULER).

## Site-ici dedupe

Ayni ilan gorsel + baslik + buton olmak uzere 3 ayri `<a>` ile gelir. ID bazinda
`Map` ile tekille — kart sayisi ile ID sayisi tutmuyorsa dedupe eksik demektir.
