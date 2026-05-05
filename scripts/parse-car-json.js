import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pushSoldAudit } from './lib/sold.js';
import { classifyBodyStyle, rawCarToTextObj, rawCarApifyCategory } from './lib/body-style.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const listingsDir = path.resolve(__dirname, '../src/data/listings');
const carJsonPath = path.resolve(__dirname, '../car.json');
const equipmentRulesPath = path.resolve(__dirname, '../src/data/metadata/EQUIPMENT_RULES.json');

const CoupeWithSunroofPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF.json');
const CoupeWithoutSunroofPath = path.join(listingsDir, 'COUPE_GAS_WITHOUT_SUNROOF.json');
const dieselWithSunroofPath = path.join(listingsDir, 'COUPE_DIESEL_WITH_SUNROOF.json');
const granCoupePath = path.join(listingsDir, 'GRAN_COUPE.json');
const granCoupeKazaliPath = path.join(listingsDir, 'GRAN_COUPE_KAZALI.json');
const cabrioPath = path.join(listingsDir, 'CABRIO.json');
const rwdGasWithSunroofPath = path.join(listingsDir, 'COUPE_GAS_RWD_WITH_SUNROOF.json');
const rwdGasWithoutSunroofPath = path.join(listingsDir, 'COUPE_GAS_RWD_WITHOUT_SUNROOF.json');
const soldPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_SOLD.json');
const kazaliPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_KAZALI.json');
const cakalPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_CAKAL.json');
const deletedPath = path.join(listingsDir, 'DELETED_CARS.json');

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

function determineDrivetrain(title, description, url, features = []) {
  const allText = `${title} ${description} ${url}`;
  const hasXDrive = /x[- ]?drive/i.test(allText);
  const hasAllrad = /allrad/i.test(description);
  // Güçlü RWD sinyali: ilan metninde/başlığında açıkça geçen ibareler
  const hasStrongRWD = /\bRWD\b/.test(title)
    || /hinterradantrieb/i.test(description)
    || /heckantrieb/i.test(description);
  // Zayıf RWD sinyali: sadece Apify features etiketi (yanıltıcı olabiliyor)
  const hasWeakRWD = features.includes("Rear wheel drive");

  if (hasXDrive || hasAllrad) return { type: "xDrive AWD", certain: true };
  if (hasStrongRWD) return { type: "RWD", certain: true };
  if (hasWeakRWD) return {
    type: "xDrive AWD",
    certain: false,
    note: "⚠️ Apify 'Rear wheel drive' etiketi mevcut ama ilan metninde teyit (Heckantrieb/Hinterradantrieb) yok. xDrive varsayıldı — satıcıdan teyit alınmalı."
  };
  return { type: "xDrive AWD", certain: false };
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

  // impliedBy: parent özellik description'da varsa, alt özelliği "yes" yap
  for (const rule of equipmentRules) {
    if (rule.impliedBy && equipmentFeatures[rule.code] !== "yes") {
      const parentFound = rule.impliedBy.some(p => descNormalized.includes(p.toLowerCase().replace(/[-–]/g, ' ')));
      if (parentFound) {
        equipmentFeatures[rule.code] = "yes";
      }
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
  const drivetrain = determineDrivetrain(car.title || "", description, car.url || "", features);

  return {
    listingId: nextId,
    listingUrl: car.url,
    mobileDeId: mobileDeId,
    exteriorColorName: props.manufacturerColour || props.colour,
    interiorColorName: props.upholstery,
    drivetrainType: drivetrain.type,
    drivetrainCertain: drivetrain.certain,
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
    listingDates: {
      createdTime: car.createdTime || null,
      modifiedTime: car.modifiedTime || null,
      renewedTime: car.renewedTime || null
    },
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
    cardThemeColorHex: (props.manufacturerColour || "").includes("weiß") ? "#e2e8f0" : "#94a3b8",
    aiCommentary: !drivetrain.certain ? [drivetrain.note || "⚠️ Tahrik tipi (xDrive/RWD) ilan metninden kesin tespit edilemedi. xDrive olarak varsayıldı — satıcıdan teyit alınmalı."] : null
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
      'numberOfPreviousOwners', 'warranty', 'service', 'nextInspectionDate', 'co2EmissionsGramPerKm',
      'drivetrainType', 'drivetrainCertain'
  ];  
  const overrides = existingCar.overrideFeatures || {};
  fieldsToCheck.forEach(key => {
      if (overrides[key]) return; // Manuel override korunuyor (obje veya değer varsa atla)
      if (newCar[key] !== undefined && existingCar[key] !== newCar[key] && JSON.stringify(existingCar[key]) !== JSON.stringify(newCar[key])) {
          changes[key] = { old: existingCar[key], new: newCar[key] };
          existingCar[key] = newCar[key];
          hasChanges = true;
      }
  });

  // equipmentFeatures alanı detaylı kontrol ediliyor
  // overrideFeatures'da tanımlı olanlar ASLA otomatik güncellenmez
  if (newCar.equipmentFeatures && existingCar.equipmentFeatures) {
      Object.keys(newCar.equipmentFeatures).forEach(feat => {
          if (overrides[feat]) return; // Manuel override korunuyor
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
  const dumpDir = path.resolve(__dirname, '../dump');
  const allDumpFiles = fs.readdirSync(dumpDir).filter(f => f.endsWith('.json'));

  if (allDumpFiles.length === 0) {
      console.error('dump/ dizininde işlenecek JSON dosyası bulunamadı.');
      process.exit(0);
  }

  // Opsiyonel CLI filtresi: sadece belirtilen mobile.de ID'lerini işle
  const filterIds = process.argv.slice(2).map(s => s.trim()).filter(Boolean);
  if (filterIds.length > 0) {
      console.log(`🔎 Filtre aktif: sadece ${filterIds.length} ID işlenecek (${filterIds.join(', ')})`);
  }

  // Her mobileDeId için sadece en yeni dump dosyasını al (flip-flop önleme)
  const latestDumps = {};
  for (const filename of allDumpFiles) {
      const [id, tsRaw] = filename.replace('.json', '').split('_');
      if (filterIds.length > 0 && !filterIds.includes(id)) continue;
      const ts = parseInt(tsRaw);
      if (!latestDumps[id] || ts > latestDumps[id].ts) {
          latestDumps[id] = { ts, filename };
      }
  }
  const carData = [];
  for (const { filename } of Object.values(latestDumps)) {
      const filePath = path.join(dumpDir, filename);
      carData.push(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  }

  if (carData.length === 0) {
      console.error('İşlenecek geçerli araç verisi bulunamadı.');
      process.exit(1);
  }

  const CoupeWithSunroof = JSON.parse(fs.readFileSync(CoupeWithSunroofPath, 'utf-8'));
  const CoupeWithoutSunroof = JSON.parse(fs.readFileSync(CoupeWithoutSunroofPath, 'utf-8'));
  const dieselWithSunroof = JSON.parse(fs.readFileSync(dieselWithSunroofPath, 'utf-8'));
  const granCoupe = JSON.parse(fs.readFileSync(granCoupePath, 'utf-8'));
  const granCoupeKazali = fs.existsSync(granCoupeKazaliPath) ? JSON.parse(fs.readFileSync(granCoupeKazaliPath, 'utf-8')) : [];
  const cabrio = fs.existsSync(cabrioPath) ? JSON.parse(fs.readFileSync(cabrioPath, 'utf-8')) : [];
  const rwdGasWithSunroof = fs.existsSync(rwdGasWithSunroofPath) ? JSON.parse(fs.readFileSync(rwdGasWithSunroofPath, 'utf-8')) : [];
  const rwdGasWithoutSunroof = fs.existsSync(rwdGasWithoutSunroofPath) ? JSON.parse(fs.readFileSync(rwdGasWithoutSunroofPath, 'utf-8')) : [];
  const sold = JSON.parse(fs.readFileSync(soldPath, 'utf-8'));
  const kazali = JSON.parse(fs.readFileSync(kazaliPath, 'utf-8'));
  const cakal = JSON.parse(fs.readFileSync(cakalPath, 'utf-8'));
  const deleted = JSON.parse(fs.readFileSync(deletedPath, 'utf-8'));

  // Taşınabilir (aktif) dosyalar — sold/cakal/deleted taşınmaz
  const activeFiles = [
    { name: 'COUPE_GAS_WITH_SUNROOF', data: CoupeWithSunroof },
    { name: 'COUPE_GAS_WITHOUT_SUNROOF', data: CoupeWithoutSunroof },
    { name: 'COUPE_DIESEL_WITH_SUNROOF', data: dieselWithSunroof },
    { name: 'COUPE_GAS_RWD_WITH_SUNROOF', data: rwdGasWithSunroof },
    { name: 'COUPE_GAS_RWD_WITHOUT_SUNROOF', data: rwdGasWithoutSunroof },
    { name: 'GRAN_COUPE', data: granCoupe },
    { name: 'GRAN_COUPE_KAZALI', data: granCoupeKazali },
    { name: 'CABRIO', data: cabrio },
    { name: 'COUPE_GAS_WITH_SUNROOF_KAZALI', data: kazali },
  ];
  const frozenFiles = [
    { name: 'SOLD', data: sold },
    { name: 'CAKAL', data: cakal },
    { name: 'DELETED', data: deleted },
  ];

  let currentAllListings = [...activeFiles, ...frozenFiles].flatMap(f => f.data);

  function findCarAndSource(mobileDeId) {
    for (const file of [...activeFiles, ...frozenFiles]) {
      const car = file.data.find(c => c.mobileDeId === mobileDeId);
      if (car) return { car, source: file };
    }
    return { car: null, source: null };
  }

  function detectDamageReason(rawCar) {
    if (rawCar.isDamaged === true) return 'Apify isDamaged alanı true';
    if (typeof rawCar.isDamaged === 'string' && rawCar.isDamaged.includes('Unfallvorschaden')) return `Apify isDamaged metninde tespit edildi: "${rawCar.isDamaged}"`;
    if (!!rawCar.isDamaged && typeof rawCar.isDamaged !== 'string') return 'Apify isDamaged alanı truthy';
    const vehicleCondition = rawCar.attributes?.['Vehicle condition'] || '';
    if (vehicleCondition.includes('accident')) return `Apify 'Vehicle condition' alanı: "${vehicleCondition}"`;
    const description = rawCar.description || '';
    const vorschadenMatch = description.match(/[^.\n]*Vorschaden[^.\n]*/i);
    if (vorschadenMatch) return `İlan açıklamasında tespit edildi: "${vorschadenMatch[0].trim()}"`;
    return null;
  }

  function determineTargetFile(car, rawCar) {
    const overrides = car.overrideFeatures || {};
    const isSunroof = car.equipmentFeatures.S403A === "yes";
    const driveResult = determineDrivetrain(rawCar.title || "", rawCar.description || "", rawCar.url || "", rawCar.features || []);
    const driveOverride = overrides.drivetrainType?.value || overrides.drivetrainType;
    const isRWD = driveOverride === "RWD" || (driveResult.type === "RWD" && driveResult.certain);
    const textObj = rawCarToTextObj(rawCar);
    const apifyCategory = rawCarApifyCategory(rawCar);
    const bodyStyle = classifyBodyStyle(textObj, { apifyCategory });
    const isDiesel = (rawCar.properties?.fuelType || "").toLowerCase().includes("diesel") || /m440d/i.test(rawCar.title || "");
    const damageReason = detectDamageReason(rawCar);

    if (bodyStyle === 'CABRIO') return { target: 'CABRIO' };
    if (bodyStyle === 'GRAN_COUPE') {
      return damageReason
        ? { target: 'GRAN_COUPE_KAZALI', reason: damageReason }
        : { target: 'GRAN_COUPE' };
    }
    if (damageReason) return { target: 'COUPE_GAS_WITH_SUNROOF_KAZALI', reason: damageReason };
    if (isDiesel) return { target: 'COUPE_DIESEL_WITH_SUNROOF' };
    if (isRWD) return { target: isSunroof ? 'COUPE_GAS_RWD_WITH_SUNROOF' : 'COUPE_GAS_RWD_WITHOUT_SUNROOF' };
    return { target: isSunroof ? 'COUPE_GAS_WITH_SUNROOF' : 'COUPE_GAS_WITHOUT_SUNROOF' };
  }

  for (const car of carData) {
    // Apify "Listing does not exists anymore" cevabı: ilan mobile.de'den kalkmış → otomatik SOLD'a taşı
    if (car.title === 'Listing does not exists anymore') {
      const deadId = String(car.id ?? car.url?.match(/\/a\/(\d+)/)?.[1] ?? '').trim();
      if (!deadId) {
        console.warn(`⚠️ Kalkmış ilan ama mobileDeId tespit edilemedi — url: ${car.url}`);
        continue;
      }
      const { car: existingCar, source } = findCarAndSource(deadId);
      if (!existingCar) {
        console.log(`ℹ️ Kalkmış ilan ${deadId} aktif listelerde zaten yok, atlanıyor.`);
        continue;
      }
      if (frozenFiles.includes(source)) {
        console.log(`ℹ️ ${existingCar.listingId} (${deadId}) zaten ${source.name}'da — atlanıyor.`);
        continue;
      }
      const idx = source.data.indexOf(existingCar);
      source.data.splice(idx, 1);
      pushSoldAudit(existingCar, `${source.name}.json`, "Apify taramasında ilan bulunamadı (mobile.de'den kalktı)");
      sold.push(existingCar);
      console.log(`🏷️  ${existingCar.listingId} (${deadId}) SATILDI (mobile.de'den kalktı) — ${source.name} → SOLD`);
      continue;
    }

    const mobileDeIdMatch = car.url?.match(/id=(\d+)/) || car.url?.match(/\/(\d+)\.html/);
    const mobileDeId = mobileDeIdMatch ? mobileDeIdMatch[1] : null;

    const { car: existingCar, source } = mobileDeId ? findCarAndSource(mobileDeId) : { car: null, source: null };

    if (existingCar) {
        const parsedCar = parseCar(car, existingCar.listingId);
        const { hasChanges, changes } = applyUpdatesAndGetChanges(existingCar, parsedCar);

        // listingDates güncelle
        existingCar.listingDates = existingCar.listingDates || {};
        if (car.createdTime) existingCar.listingDates.createdTime = car.createdTime;
        if (car.modifiedTime) existingCar.listingDates.modifiedTime = car.modifiedTime;
        if (car.renewedTime) existingCar.listingDates.renewedTime = car.renewedTime;

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
            existingCar.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));
            console.log(`✅ ${existingCar.listingId} başarıyla güncellendi (Fiyat, km veya donanım değişti).`);
        } else {
            existingCar.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));
            console.log(`ℹ️ ${existingCar.listingId} tarandı ancak değişen bir veri bulunamadı.`);
        }

        // Dosya yerleşim kontrolü — sadece aktif dosyalardaki araçlar taşınabilir
        const isFrozen = frozenFiles.some(f => f === source);
        if (!isFrozen) {
            const { target: targetName, reason } = determineTargetFile(existingCar, car);
            if (targetName !== source.name) {
                const idx = source.data.indexOf(existingCar);
                source.data.splice(idx, 1);
                const targetFile = activeFiles.find(f => f.name === targetName);
                targetFile.data.push(existingCar);
                existingCar.auditHistory.push({
                    action: `Dosya Taşıma: ${source.name} → ${targetName}`,
                    detail: reason ?? "Yeniden değerlendirme sonucu doğru dosyaya taşındı",
                    changes: null,
                    auditDate: new Date().toISOString()
                });
                if (reason) {
                    existingCar.listingDescriptionNotes = existingCar.listingDescriptionNotes || [];
                    const note = `⚠️ ${targetName} olarak işaretlendi — ${reason}`;
                    if (!existingCar.listingDescriptionNotes.includes(note)) {
                        existingCar.listingDescriptionNotes.push(note);
                    }
                }
                console.log(`🔀 ${existingCar.listingId} taşındı: ${source.name} → ${targetName}${reason ? ` (${reason})` : ''}`);
            }
        }
    } else {
        const nextId = getNextListingId(currentAllListings);
        const parsedCar = parseCar(car, nextId);
        currentAllListings.push(parsedCar);

        const { target: targetName, reason } = determineTargetFile(parsedCar, car);
        const targetFile = activeFiles.find(f => f.name === targetName);
        if (reason) {
            parsedCar.listingDescriptionNotes = parsedCar.listingDescriptionNotes || [];
            parsedCar.listingDescriptionNotes.push(`⚠️ ${targetName} olarak işaretlendi — ${reason}`);
        }
        targetFile.data.push(parsedCar);
        console.log(`✅ Yeni eklendi: ${nextId} (${targetName}.json)${reason ? ` — ${reason}` : ''}`);
    }
  }

  // Tüm değişiklikleri diske yaz
  fs.writeFileSync(CoupeWithSunroofPath, JSON.stringify(CoupeWithSunroof, null, 2));
  fs.writeFileSync(CoupeWithoutSunroofPath, JSON.stringify(CoupeWithoutSunroof, null, 2));
  fs.writeFileSync(dieselWithSunroofPath, JSON.stringify(dieselWithSunroof, null, 2));
  fs.writeFileSync(rwdGasWithSunroofPath, JSON.stringify(rwdGasWithSunroof, null, 2));
  fs.writeFileSync(rwdGasWithoutSunroofPath, JSON.stringify(rwdGasWithoutSunroof, null, 2));
  fs.writeFileSync(granCoupePath, JSON.stringify(granCoupe, null, 2));
  fs.writeFileSync(granCoupeKazaliPath, JSON.stringify(granCoupeKazali, null, 2));
  fs.writeFileSync(cabrioPath, JSON.stringify(cabrio, null, 2));
  fs.writeFileSync(kazaliPath, JSON.stringify(kazali, null, 2));
  fs.writeFileSync(soldPath, JSON.stringify(sold, null, 2));
}

run().catch(console.error);
