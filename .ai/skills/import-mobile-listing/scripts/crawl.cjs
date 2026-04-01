const https = require('https');
const url = process.argv[2];

if (!url) {
  console.error('Lütfen bir mobile.de URL\'si sağlayın.');
  process.exit(1);
}

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 403) {
      console.log(JSON.stringify({ 
        error: "BOT_BLOCKED", 
        message: "mobile.de bot koruması nedeniyle erişim engellendi. Lütfen araç detaylarını (fiyat, km, yıl, donanım) manuel olarak paylaşın veya sayfa metnini buraya yapıştırın." 
      }));
      process.exit(0);
    }
    
    if (res.statusCode !== 200) {
      console.error(`HTTP Status: ${res.statusCode}`);
      process.exit(1);
    }

    // Basit regex ile temel verileri çekme denemesi (Eğer 200 dönerse)
    const idMatch = url.match(/id=(\d+)/);
    const title = (data.match(/<title>(.*?)<\/title>/) || [])[1] || "Bilinmiyor";
    
    console.log(JSON.stringify({
      listingId: idMatch ? `C${idMatch[1].substring(0, 3)}` : "C?", // Örnek ID formatı
      listingUrl: url,
      rawTitle: title,
      success: true
    }, null, 2));
  });
}).on('error', (err) => {
  console.error(`Hata: ${err.message}`);
  process.exit(1);
});