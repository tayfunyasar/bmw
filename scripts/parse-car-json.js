import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const listingsDir = path.resolve(__dirname, '../src/data/listings');
const carJsonPath = path.resolve(__dirname, '../car.json');
const equipmentRulesPath = path.resolve(__dirname, '../src/data/metadata/EQUIPMENT_RULES.json');

const CoupeWithSunroofPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF.json');
const CoupeWithoutSunroofPath = path.join(listingsDir, 'COUPE_GAS_WITHOUT_SUNROOF.json');
const granCoupePath = path.join(listingsDir, 'GRAN_COUPE.json');
const rwdGasWithSunroofPath = path.join(listingsDir, 'COUPE_GAS_RWD_WITH_SUNROOF.json');
const rwdGasWithoutSunroofPath = path.join(listingsDir, 'COUPE_GAS_RWD_WITHOUT_SUNROOF.json');

const equipmentRules = JSON.parse(fs.readFileSync(equipmentRulesPath, 'utf8'));

function getNextListingId(existingListings) {
  let maxId = 0;
  existingListings.forEach(l => {
    const idMatch = l.listingId?.match(/C(\d+)/);
    if (idMatch) {
      const id = parseInt(idMatch[1]);
      if (id > maxId) maxId = id;
    }
  });
  return `C${maxId + 1}`;
}

function parseCar(car, nextId) {
  const features = car.features || [];
  const description = car.description || "";
  const props = car.properties || {};
  const attributes = car.attributes || {};

  const equipmentFeatures = {};
  const descNormalized = description.toLowerCase().replace(/[-–]/g, ' ');

  for (const rule of equipmentRules) {
    // Helper: case-insensitive, dash/hyphen-tolerant matching against description
    const descMatches = (keyword) => descNormalized.includes(keyword.toLowerCase().replace(/[-–]/g, ' '));

    // 1. Check positive description match (HIGHEST PRIORITY — dealer's own text is authoritative)
    let matchDescription = false;
    if (rule.matchType === 'ALL_DESCRIPTION' && rule.description && rule.description.length > 0) {
      matchDescription = rule.description.every(d => descMatches(d));
    } else if (rule.description && rule.description.length > 0) {
      matchDescription = rule.description.some(d => descMatches(d));
    }

    if (matchDescription) {
      equipmentFeatures[rule.code] = "yes";
      continue;
    }

    // 2. Check negative descriptions (only matters when no positive description match)
    let hasNegative = false;
    if (rule.negativeDescription && rule.negativeDescription.length > 0) {
      hasNegative = rule.negativeDescription.some(nd => descMatches(nd));
    }

    if (hasNegative) {
      equipmentFeatures[rule.code] = "no";
      continue;
    }

    // 3. Check features array and props (Apify key-value data — lower priority)
    const matchFeatures = rule.features && rule.features.some(f => features.includes(f));

    let matchProps = false;
    if (rule.props) {
      matchProps = Object.entries(rule.props).some(([propKey, propValues]) => {
        const carPropVal = props[propKey] || "";
        return propValues.some(val => carPropVal.includes(val));
      });
    }

    if (matchFeatures || matchProps) {
      equipmentFeatures[rule.code] = "yes";
    } else {
      equipmentFeatures[rule.code] = "unknown";
    }
  }

  const regMatch = (props.firstRegistration || "").match(/(\d+)\/(\d+)/);
  const firstRegistrationYearAndMonth = regMatch ? [parseInt(regMatch[2]), parseInt(regMatch[1])] : [null, null];

  let modelGeneration = "Pre-LCI";
  if (firstRegistrationYearAndMonth[0] > 2023 || (firstRegistrationYearAndMonth[0] === 2023 && firstRegistrationYearAndMonth[1] >= 7)) {
    modelGeneration = "LCI";
  }

  let estimatedImportTaxEuro = 0;
  if (modelGeneration === "Pre-LCI") {
    if (firstRegistrationYearAndMonth[0] <= 2021) estimatedImportTaxEuro = 4112;
    else estimatedImportTaxEuro = 7428;
  } else {
    estimatedImportTaxEuro = 11097;
  }

  const sellerName = car.dealer?.name || "Unknown Dealer";
  const sellerRating = car.dealer?.rating?.total ? ` ★${car.dealer.rating.total}` : "";

  const countryFlags = {
    "DE": "🇩🇪",
    "LT": "🇱🇹",
    "AT": "🇦🇹",
    "NL": "🇳🇱",
    "BE": "🇧🇪",
    "CH": "🇨🇭",
    "PL": "🇵🇱",
    "CZ": "🇨🇿",
    "IT": "🇮🇹",
    "FR": "🇫🇷",
    "ES": "🇪🇸"
  };
  const countryCode = car.dealer?.contry || "DE";
  const flag = countryFlags[countryCode] || "🇪🇺"; // fallback to EU
  
  // Extract city: sometimes it's "DE-88131 Lindau" in [1], sometimes in [0] if private seller.
  let rawCity = "Unknown";
  if (car.dealer?.addesses && car.dealer.addesses.length > 0) {
    const addressLine = car.dealer.addesses[car.dealer.addesses.length - 1]; // usually the last line is Zip + City
    rawCity = addressLine.split('-').pop().trim();
  }

  const mobileDeIdMatch = car.url?.match(/id=(\d+)/) || car.url?.match(/\/(\d+)\.html/);
  const mobileDeId = mobileDeIdMatch ? mobileDeIdMatch[1] : null;
  
  const serviceType = description.includes("Scheckheftgepflegt") || features.includes("Full Service History") ? "yes" : "unknown";
  const hasWarranty = features.includes("Warranty") ? "yes" : "no";

  return {
    listingId: nextId,
    listingUrl: car.url,
    mobileDeId: mobileDeId,
    exteriorColorName: props.manufacturerColour || props.colour,
    interiorColorName: props.upholstery,
    drivetrainType: /x[- ]?drive/i.test(car.title || "") || /x[- ]?drive/i.test(description) || /x[- ]?drive/i.test(car.url || "") ? "xDrive AWD" : "RWD",
    basePriceEuro: car.price?.amount,
    estimatedImportTaxEuro: estimatedImportTaxEuro,
    mileageKm: parseInt((props.milage || "0").replace(/[^0-9]/g, "")),
    firstRegistrationYearAndMonth: firstRegistrationYearAndMonth,
    numberOfPreviousOwners: props.numberOfOwners || "?",
    warranty: {
      exists: hasWarranty
    },
    service: {
      type: serviceType,
      history: []
    },
    nextInspectionDate: props.generalInspection || "?",
    sellerTypeOrName: `${sellerName}${sellerRating}`,
    modelGeneration: modelGeneration,
    co2EmissionsGramPerKm: parseInt(props.co2Emission) || 0,
    listingLocation: `${flag} ${rawCity}`,
    curatorPickBadge: null,
    curatorPersonalNotes: [],
    listingDescriptionNotes: [],
    listingAdditionalFeatures: [],
    equipmentFeatures: equipmentFeatures,
    auditHistory: [
      ...(car.createdTime ? [{
        action: "İlan Yayınlandı (mobile.de)",
        detail: null,
        changes: null,
        auditDate: car.createdTime
      }] : []),
      {
        action: "İlan Eklendi",
        detail: "Sistem tarafından kayıt altına alındı",
        changes: null,
        auditDate: new Date().toISOString()
      },
      ...(car.renewedTime && car.renewedTime !== car.createdTime ? [{
        action: "İlan Yenilendi (mobile.de)",
        detail: null,
        changes: null,
        auditDate: car.renewedTime
      }] : [])
    ].sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate)),
    cardThemeColorHex: (props.manufacturerColour || "").includes("weiß") ? "#e2e8f0" : "#94a3b8"
  };
}

// Diff and Apply modifications function
function applyUpdatesAndGetChanges(existingCar, newCar) {
  const changes = {};
  let hasChanges = false;
  
  // Ana alanlar kontrol ediliyor
  const fieldsToCheck = [
      'basePriceEuro', 'mileageKm', 'sellerTypeOrName',
      'listingLocation', 'exteriorColorName', 'interiorColorName',
      'numberOfPreviousOwners', 'warranty', 'service', 'nextInspectionDate', 'co2EmissionsGramPerKm'
  ];  
  fieldsToCheck.forEach(key => {
      // Sadece gerçekten değişmişse ve anlamlı değerse güncelle
      if (newCar[key] !== undefined && existingCar[key] !== newCar[key] && JSON.stringify(existingCar[key]) !== JSON.stringify(newCar[key])) {
          changes[key] = { old: existingCar[key], new: newCar[key] };
          existingCar[key] = newCar[key];
          hasChanges = true;
      }
  });

  // equipmentFeatures alanı detaylı kontrol ediliyor
  // overrideFeatures'da tanımlı olanlar ASLA otomatik güncellenmez
  const overrides = existingCar.overrideFeatures || {};
  if (newCar.equipmentFeatures && existingCar.equipmentFeatures) {
      Object.keys(newCar.equipmentFeatures).forEach(feat => {
          if (feat in overrides) return; // Manuel override korunuyor
          if (existingCar.equipmentFeatures[feat] !== newCar.equipmentFeatures[feat]) {
              changes[`equipmentFeatures.${feat}`] = {
                  old: existingCar.equipmentFeatures[feat],
                  new: newCar.equipmentFeatures[feat]
              };
              existingCar.equipmentFeatures[feat] = newCar.equipmentFeatures[feat];
              hasChanges = true;
          }
      });
  }
  
  return { hasChanges, changes };
}

async function run() {
  const latestImportPath = path.resolve(__dirname, '../dump/.latest_import');
  if (!fs.existsSync(latestImportPath)) {
      console.error('İşlenecek yeni araç bulunamadı (dump/.latest_import eksik).');
      process.exit(0);
  }

  const filesToProcess = fs.readFileSync(latestImportPath, 'utf-8').split('\n').filter(Boolean);
  const carData = [];
  const dumpDir = path.resolve(__dirname, '../dump');

  for (const filename of filesToProcess) {
      // Sadece dosya adını al (eğer tam yol gelirse diye önlem)
      const pureFilename = path.basename(filename);
      const filePath = path.join(dumpDir, pureFilename);
      
      if (fs.existsSync(filePath)) {
          carData.push(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
      }
  }

  if (carData.length === 0) {
      console.error('İşlenecek geçerli araç verisi bulunamadı.');
      process.exit(1);
  }

  const CoupeWithSunroof = JSON.parse(fs.readFileSync(CoupeWithSunroofPath, 'utf-8'));
  const CoupeWithoutSunroof = JSON.parse(fs.readFileSync(CoupeWithoutSunroofPath, 'utf-8'));
  const granCoupe = JSON.parse(fs.readFileSync(granCoupePath, 'utf-8'));
  const rwdGasWithSunroof = fs.existsSync(rwdGasWithSunroofPath) ? JSON.parse(fs.readFileSync(rwdGasWithSunroofPath, 'utf-8')) : [];
  const rwdGasWithoutSunroof = fs.existsSync(rwdGasWithoutSunroofPath) ? JSON.parse(fs.readFileSync(rwdGasWithoutSunroofPath, 'utf-8')) : [];

  let currentAllListings = [...CoupeWithSunroof, ...CoupeWithoutSunroof, ...rwdGasWithSunroof, ...rwdGasWithoutSunroof, ...granCoupe];

  for (const car of carData) {
    const mobileDeIdMatch = car.url?.match(/id=(\d+)/) || car.url?.match(/\/(\d+)\.html/);
    const mobileDeId = mobileDeIdMatch ? mobileDeIdMatch[1] : null;

    let existingCar = null;

    // Sistemde var mı diye kontrol et (Yalnızca tam liste olan Coupe listelerine bakıyoruz, GC summary olduğu için es geçiyoruz)
    if (mobileDeId) {
        existingCar = CoupeWithSunroof.find(c => c.mobileDeId === mobileDeId);
        if (!existingCar) {
            existingCar = CoupeWithoutSunroof.find(c => c.mobileDeId === mobileDeId);
        }
        if (!existingCar) {
            existingCar = rwdGasWithSunroof.find(c => c.mobileDeId === mobileDeId);
        }
        if (!existingCar) {
            existingCar = rwdGasWithoutSunroof.find(c => c.mobileDeId === mobileDeId);
        }
        if (!existingCar) {
            existingCar = granCoupe.find(c => c.mobileDeId === mobileDeId);
        }
    }

    if (existingCar) {
        // Mevcut aracı GÜNCELLE ve AUDIT_HISTORY oluştur
        const parsedCar = parseCar(car, existingCar.listingId);
        const { hasChanges, changes } = applyUpdatesAndGetChanges(existingCar, parsedCar);

        // renewedTime değiştiyse auditHistory'ye ekle
        existingCar.auditHistory = existingCar.auditHistory || [];
        if (car.renewedTime) {
            const alreadyHasRenewed = existingCar.auditHistory.some(a =>
                a.action === 'İlan Yenilendi (mobile.de)' && a.auditDate === car.renewedTime
            );
            if (!alreadyHasRenewed) {
                existingCar.auditHistory.push({
                    action: "İlan Yenilendi (mobile.de)",
                    detail: null,
                    changes: null,
                    auditDate: car.renewedTime
                });
            }
        }

        if (hasChanges) {
            existingCar.auditHistory.push({
                action: "İlan Güncellemesi (Otomatik)",
                detail: "Apify tekrar taraması sonucu veriler eşitlendi",
                changes: changes,
                auditDate: new Date().toISOString()
            });

            // Tarih sırasına göre sırala
            existingCar.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));

            console.log(`✅ ${existingCar.listingId} başarıyla güncellendi (Fiyat, km veya donanım değişti).`);
        } else {
            existingCar.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));
            console.log(`ℹ️ ${existingCar.listingId} tarandı ancak değişen bir veri bulunamadı.`);
        }
    } else {
        // Yeni araç ekleme rutini
        const nextId = getNextListingId(currentAllListings);
        const parsedCar = parseCar(car, nextId);
        
        // Yeni ID'yi havuza ekle ki aynı çalışmada tekrar üretilmesin
        currentAllListings.push(parsedCar);

        const isSunroof = parsedCar.equipmentFeatures.S403A === "yes";
        const isRWD = parsedCar.drivetrainType === "RWD";
        const isGC = car.title?.includes("GC") || car.subTitle?.includes("GC") || car.description?.includes("Gran Coupe") || car.description?.includes("Gran Coupé");

        if (isGC) {
          granCoupe.push(parsedCar);
          console.log(`✅ Yeni eklendi: ${nextId} (GRAN_COUPE.json)`);
        } else if (isRWD) {
          if (isSunroof) {
            rwdGasWithSunroof.push(parsedCar);
            console.log(`✅ Yeni eklendi: ${nextId} (COUPE_GAS_RWD_WITH_SUNROOF.json)`);
          } else {
            rwdGasWithoutSunroof.push(parsedCar);
            console.log(`✅ Yeni eklendi: ${nextId} (COUPE_GAS_RWD_WITHOUT_SUNROOF.json)`);
          }
        } else if (isSunroof) {
          CoupeWithSunroof.push(parsedCar);
          console.log(`✅ Yeni eklendi: ${nextId} (COUPE_WITH_SUNROOF.json)`);
        } else {
          CoupeWithoutSunroof.push(parsedCar);
          console.log(`✅ Yeni eklendi: ${nextId} (COUPE_WITHOUT_SUNROOF.json)`);
        }
    }
  }

  // Tüm değişiklikleri diske yaz
  fs.writeFileSync(CoupeWithSunroofPath, JSON.stringify(CoupeWithSunroof, null, 2));
  fs.writeFileSync(CoupeWithoutSunroofPath, JSON.stringify(CoupeWithoutSunroof, null, 2));
  fs.writeFileSync(rwdGasWithSunroofPath, JSON.stringify(rwdGasWithSunroof, null, 2));
  fs.writeFileSync(rwdGasWithoutSunroofPath, JSON.stringify(rwdGasWithoutSunroof, null, 2));
  fs.writeFileSync(granCoupePath, JSON.stringify(granCoupe, null, 2));
}

run().catch(console.error);
