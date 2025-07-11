// Node.js script: generate-prompt.js
// Usage: node generate-prompt.js

import fs from 'fs/promises';
import path from 'path';

// --- Country data (teljes lista) ---
const countryData = {
  germany: {
    name: "Germany",
    code: "DE",
    language: "German",
    homeDelivery: ["DHL", "Hermes", "DPD", "UPS", "GLS", "trans-o-flex", "Fedex", "Deutsche Post"],
    parcelShops: ["DHL Paketshop", "Hermes Paketshop", "UPS Access Point", "DPD Pickup", "GLS Parcel Shop"],
    parcelLockers: ["DHL Packstation", "MyFlexBox", "UPS Access Point"],
    shippingPages: ["/versand", "/lieferung", "/shipping", "/delivery"],
    footerLinks: ["versand", "lieferung", "shipping", "informationen zur lieferung", "versandkosten"],
    islands: "German islands like Sylt, Rügen, Usedom, etc.",
    hasIslands: true
  },
  france: {
    name: "France",
    code: "FR",
    language: "French",
    homeDelivery: ["Colissimo", "Chronopost", "DPD", "GLS", "UPS", "Colis Privé", "DHL", "La Poste"],
    parcelShops: ["Mondial Relay (InPost)", "Chronopost", "Colissimo", "La Poste branches", "DPD Pickup", "Relais Colis", "GLS Parcel Shop"],
    parcelLockers: ["Mondial Relay (InPost)", "Chronopost", "Colissimo"],
    shippingPages: ["/livraison", "/expedition", "/shipping", "/delivery"],
    footerLinks: ["livraison", "expédition", "shipping", "informations de livraison", "frais de livraison"],
    islands: "French islands like Corsica, overseas territories, etc.",
    hasIslands: true
  },
  italy: {
    name: "Italy",
    code: "IT",
    language: "Italian",
    homeDelivery: ["BRT (Bartolini)", "GLS", "SDA/Poste Italiane", "UPS", "DHL", "FedEx/TNT"],
    parcelShops: ["BRT/Fermopoint", "UPS", "Poste Italiane SDA", "Punto Poste", "InPost", "GLS", "TNT/Fedex", "DHL"],
    parcelLockers: ["BRT", "InPost", "Punto Poste", "SDA"],
    shippingPages: ["/spedizione", "/consegna", "/shipping", "/delivery"],
    footerLinks: ["spedizione", "consegna", "shipping", "informazioni sulla consegna", "costi di spedizione"],
    islands: "Italian islands like Sicily, Sardinia, etc.",
    hasIslands: true
  },
  spain: {
    name: "Spain",
    code: "ES",
    language: "Spanish",
    homeDelivery: ["Correos", "SEUR", "GLS", "DHL", "UPS", "MRW", "Nacex", "Paack"],
    parcelShops: ["Correos/Post branch", "InPost (Mondial Relay)", "SEUR", "GLS Parcel Shop", "UPS Access Point", "Celeritas"],
    parcelLockers: ["InPost", "SEUR", "Correos - Citipaq", "DHL"],
    shippingPages: ["/envio", "/entrega", "/shipping", "/delivery"],
    footerLinks: ["envío", "entrega", "shipping", "información de envío", "gastos de envío"],
    islands: "Spanish islands like Balearic Islands, Canary Islands, etc.",
    hasIslands: true
  },
  poland: {
    name: "Poland",
    code: "PL",
    language: "Polish",
    homeDelivery: ["DPD", "InPost", "DHL", "Poczta Polska", "GLS", "UPS", "Fedex"],
    parcelShops: ["InPost", "DPD", "Orlen", "Poczta Polska", "DHL", "GLS Parcel Shop", "UPS"],
    parcelLockers: ["InPost", "DPD", "Orlen", "DHL", "Poczta Polska"],
    shippingPages: ["/dostawa", "/shipping", "/delivery"],
    footerLinks: ["dostawa", "shipping", "informacje o dostawie", "koszty dostawy"],
    islands: "",
    hasIslands: false
  },
  czechia: {
    name: "Czechia",
    code: "CZ",
    language: "Czech",
    homeDelivery: ["Česká pošta", "PPL", "DPD", "GLS", "Zásilkovna", "DHL", "WEDO", "UPS"],
    parcelShops: ["Zásilkovna", "Česká pošta branches", "PPL Parcelshop", "DPD Pickup", "GLS Parcel Shop", "WEDO Points"],
    parcelLockers: ["Zásilkovna (Z-Box)", "Česká pošta Balíkovna", "PPL ParcelBox", "DPD Box", "GLS Locker", "AlzaBox", "WEDO Box"],
    shippingPages: ["/doprava", "/dostava", "/shipping", "/delivery"],
    footerLinks: ["doprava", "dostava", "shipping", "informace o dopravě", "poštovné"],
    islands: "",
    hasIslands: false
  },
  slovakia: {
    name: "Slovakia",
    code: "SK",
    language: "Slovak",
    homeDelivery: ["GLS", "DPD", "SPS/Slovak Parcel Service", "Slovenska Posta", "Packeta", "DHL", "UPS"],
    parcelShops: ["GLS", "DPD", "SPS/Slovak Parcel Service", "Slovenska Posta", "Packeta", "DHL", "UPS", "DEPO"],
    parcelLockers: ["Packeta (Z-Box)", "Balíkovo/SPS", "Slovenska Posta/BalíkoBOX", "GLS Locker (AlzaBox)", "DPD (AlzaBox)", "AlzaBox", "DEPO"],
    shippingPages: ["/doprava", "/dostava", "/shipping", "/delivery"],
    footerLinks: ["doprava", "dostava", "shipping", "informácie o doprave", "poštovné"],
    islands: "",
    hasIslands: false
  },
  romania: {
    name: "Romania",
    code: "RO",
    language: "Romanian",
    homeDelivery: ["Fan Courier", "Cargus", "Sameday", "DPD", "GLS", "Posta Romana", "DHL"],
    parcelShops: ["Cargus", "Packeta", "Fan Courier", "DPD", "Posta Romana branch", "GLS Parcel Shop"],
    parcelLockers: ["Sameday (Easybox)", "Fan Courier", "Cargus", "Packeta", "GLS", "DPD"],
    shippingPages: ["/livrare", "/transport", "/shipping", "/delivery"],
    footerLinks: ["livrare", "transport", "shipping", "informații livrare", "costuri transport"],
    islands: "",
    hasIslands: false
  },
  serbia: {
    name: "Serbia",
    code: "RS",
    language: "Serbian",
    homeDelivery: ["D Express", "BEX Express", "City Express", "Post Express", "AKS", "GLS"],
    parcelShops: ["Post Express/Post branch", "City Express", "AKS"],
    parcelLockers: ["D Express", "City Express", "Post Express"],
    shippingPages: ["/dostava", "/shipping", "/delivery"],
    footerLinks: ["dostava", "shipping", "informacije o dostavi", "troškovi dostave"],
    islands: "",
    hasIslands: false
  },
  croatia: {
    name: "Croatia",
    code: "HR",
    language: "Croatian",
    homeDelivery: ["GLS", "Hrvatska pošta", "DPD", "Overseas Express", "DHL", "UPS", "Gebrüder Weiss", "InTime"],
    parcelShops: ["GLS", "Hrvatska pošta", "DPD", "Overseas Express"],
    parcelLockers: ["Box Now", "GLS", "Hrvatska pošta", "DPD", "Overseas Express"],
    shippingPages: ["/dostava", "/shipping", "/delivery"],
    footerLinks: ["dostava", "shipping", "informacije o dostavi", "troškovi dostave"],
    islands: "Croatian islands like Rab, Krk, Brač, Hvar, etc.",
    hasIslands: true
  },
  slovenia: {
    name: "Slovenia",
    code: "SI",
    language: "Slovenian",
    homeDelivery: ["Pošta Slovenije", "GLS", "DPD", "DHL", "UPS", "Express One"],
    parcelShops: ["GLS", "Pošta Slovenije", "DPD", "Express One"],
    parcelLockers: ["GLS", "Pošta Slovenije", "DPD"],
    shippingPages: ["/dostava", "/shipping", "/delivery"],
    footerLinks: ["dostava", "shipping", "informacije o dostavi", "stroški dostave"],
    islands: "",
    hasIslands: false
  },
  hungary: {
    name: "Hungary",
    code: "HU",
    language: "Hungarian",
    homeDelivery: ["MPL", "GLS", "DPD", "Express One", "Sprinter (Sameday)", "DHL", "Sameday"],
    parcelShops: ["Hungarian Post (MPL)", "GLS", "Packeta", "Pick Pack Pont (Sameday)", "DPD", "Express One"],
    parcelLockers: ["Hungarian Post (MPL)", "GLS", "Foxpost", "Packeta Z-Box", "DPD", "Sameday Easybox", "Express One"],
    shippingPages: ["/szallitas", "/kiszallitas", "/shipping", "/delivery"],
    footerLinks: ["szállítás", "kiszállítás", "shipping", "szállítási információk", "szállítási költségek"],
    islands: "",
    hasIslands: false
  },
  uk: {
    name: "United Kingdom",
    code: "GB",
    language: "English",
    homeDelivery: ["Royal Mail", "DPD", "DHL", "UPS", "Evri", "Yodel", "Fedex", "Parcelforce"],
    parcelShops: ["Evri", "Royal Mail", "DPD", "InPost", "UPS", "ASDA", "Yodel", "DHL"],
    parcelLockers: ["InPost", "DPD", "Royal Mail", "Evri"],
    shippingPages: ["/delivery", "/shipping", "/postage"],
    footerLinks: ["delivery", "shipping", "postage", "delivery information", "shipping costs"],
    islands: "UK islands like Isle of Wight, Scottish islands, etc.",
    hasIslands: true
  }
};

// --- Prompt template ---
const promptTemplate = country => `Stagehand tool használatával:

1. Navigate to homepage of the website: \${website}
2. Search for shipping information to ${country.name} in these locations:
* Dedicated shipping info pages (${country.shippingPages.join(', ')})
* Footer links: "${country.footerLinks.join('", "')}"
* FAQ section: search for shipping/delivery keywords in ${country.language}
* Terms & Conditions page for shipping terms

3. Extract shipping information from all relevant pages

EXTRACT EXACTLY THESE SHIPPING CATEGORIES:

HOME DELIVERY:
* Available: yes/no
* Providers: [list of shipping companies such as: ${country.homeDelivery.join(', ')}, etc.]
* Pricing: [price information and free shipping thresholds]
* Delivery time: [timeframe - e.g., 2-5 business days]
* Express delivery: [availability, pricing, delivery time]
* Weekend delivery: [availability, which days]${country.hasIslands ? `
* Island surcharge: [extra cost or delivery restrictions to ${country.islands}]` : ''}
* COD surcharge: [cash on delivery surcharge]

BULKY PRODUCT HOME DELIVERY:
* Available: yes/no
* Providers: [list of shipping companies for bulky items such as: ${country.homeDelivery.slice(0, 4).join(', ')}, etc.]
* Pricing: [price information for bulky items]
* Delivery time: [timeframe for bulky items]
* Express delivery: [availability, pricing, delivery time for bulky items]
* Weekend delivery: [availability, which days for bulky items]${country.hasIslands ? `
* Island surcharge: [extra cost or delivery restrictions to islands for bulky items]` : ''}
* COD surcharge: [cash on delivery surcharge for bulky items]

PARCEL SHOPS / PICKUP POINTS:
* Available: yes/no
* Providers: [such as: ${country.parcelShops.join(', ')}, etc.]
* Number of locations: [number if visible]
* Pricing: [price information]
* Express delivery: [availability, pricing, delivery time]
* Weekend delivery: [availability, which days]${country.hasIslands ? `
* Island surcharge: [extra cost or delivery restrictions to islands]` : ''}
* COD surcharge: [cash on delivery surcharge]

PARCEL LOCKERS:
* Available: yes/no
* Providers: [such as: ${country.parcelLockers.join(', ')}, etc.]
* Number of locations: [number if visible]
* Pricing: [price information]
* Express delivery: [availability, pricing, delivery time]
* Weekend delivery: [availability, which days]${country.hasIslands ? `
* Island surcharge: [extra cost or delivery restrictions to islands]` : ''}
* COD surcharge: [cash on delivery surcharge]

IN-STORE PICKUP:
* Available: yes/no
* Locations: [store locations/cities if available]
* Pricing: [price information]
* Express delivery: [availability, pricing, delivery time]
* Weekend delivery: [availability, which days]${country.hasIslands ? `
* Island surcharge: [extra cost or delivery restrictions to islands]` : ''}
* COD surcharge: [cash on delivery surcharge]

Website: \${website} Country: ${country.code}

Response Format: Return exactly this JSON structure. If a field is unavailable, write "not available". Strings should be human-readable.
{
  "website": "\${website}",
  "HOME_DELIVERY": {
    "available": "yes/no/not available",
    "providers": ["provider1", "provider2"],
    "pricing": "price info or not available",
    "delivery_time": "timeframe or not available",
    "express_delivery": {
      "available": "yes/no/not available",
      "delivery_time": "timeframe or not available",
      "pricing": "price info or not available"
    },
    "weekend_delivery": {
      "available": "yes/no/not available",
      "days": ["Saturday", "Sunday"] or "not available"
    },${country.hasIslands ? `
    "island_surcharge": "extra cost or delivery restrictions to ${country.islands}, or not available",` : ''}
    "cod_surcharge": "exact surcharge or not available"
  },
  "BULKY_PRODUCT_HOME_DELIVERY": {
    "available": "yes/no/not available",
    "providers": ["provider1", "provider2"],
    "pricing": "price info or not available",
    "delivery_time": "timeframe or not available",
    "express_delivery": {
      "available": "yes/no/not available",
      "delivery_time": "timeframe or not available",
      "pricing": "price info or not available"
    },
    "weekend_delivery": {
      "available": "yes/no/not available",
      "days": ["Saturday", "Sunday"] or "not available"
    },${country.hasIslands ? `
    "island_surcharge": "extra cost or delivery restrictions to islands or not available",` : ''}
    "cod_surcharge": "exact surcharge or not available"
  },
  "PARCEL_SHOPS": {
    "available": "yes/no/not available",
    "providers": ["provider1", "provider2"],
    "locations_count": "number or not available",
    "pricing": "price info or not available",
    "express_delivery": {
      "available": "yes/no/not available",
      "delivery_time": "timeframe or not available",
      "pricing": "price info or not available"
    },
    "weekend_delivery": {
      "available": "yes/no/not available",
      "days": ["Saturday", "Sunday"] or "not available"
    },${country.hasIslands ? `
    "island_surcharge": "extra cost or delivery restrictions to islands or not available",` : ''}
    "cod_surcharge": "exact surcharge or not available"
  },
  "PARCEL_LOCKERS": {
    "available": "yes/no/not available",
    "providers": ["provider1", "provider2"],
    "locations_count": "number or not available",
    "pricing": "price info or not available",
    "express_delivery": {
      "available": "yes/no/not available",
      "delivery_time": "timeframe or not available",
      "pricing": "price info or not available"
    },
    "weekend_delivery": {
      "available": "yes/no/not available",
      "days": ["Saturday", "Sunday"] or "not available"
    },${country.hasIslands ? `
    "island_surcharge": "extra cost or delivery restrictions to islands or not available",` : ''}
    "cod_surcharge": "exact surcharge or not available"
  },
  "IN_STORE_PICKUP": {
    "available": "yes/no/not available",
    "locations": ["city1", "city2"] or "not available",
    "pricing": "price info or not available",
    "express_delivery": {
      "available": "yes/no/not available",
      "delivery_time": "timeframe or not available",
      "pricing": "price info or not available"
    },
    "weekend_delivery": {
      "available": "yes/no/not available",
      "days": ["Saturday", "Sunday"] or "not available"
    },${country.hasIslands ? `
    "island_surcharge": "extra cost or delivery restrictions to islands or not available",` : ''}
    "cod_surcharge": "exact surcharge or not available"
  },
  "SUMMARY": "[Brief summary of delivery options, providers, pricing, and restrictions]. NOTABLE FEATURES: [Key features, limitations, and special services]. WEBSITE ASSESSMENT: [Overall evaluation of shipping information quality and completeness]."
}

If something is not available or not found, write "not available".
Only extract information that is explicitly visible on the pages. Do not assume or guess.

IMPORTANT: The SUMMARY field should be formatted as a single text string that will work well when converted to a table format in Excel/CSV. Use clear section headers and concise descriptions separated by periods and line breaks where appropriate.`;

// --- Fő generálás ---
(async () => {
  for (const [key, country] of Object.entries(countryData)) {
    const prompt = promptTemplate(country);
    const outPath = path.join(process.cwd(), `prompts/prompt.${key}.txt`);
    await fs.writeFile(outPath, prompt, 'utf-8');
    console.log(`Generated: prompts/prompt.${key}.txt`);
  }
})(); 