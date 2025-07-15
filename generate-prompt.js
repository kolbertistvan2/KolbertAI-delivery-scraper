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
    hasIslands: true,
    // Return fields
    returnFooterLinks: ["rückgabe", "umtausch", "widerruf", "reklamation", "return", "exchange", "refund"],
    returnFaqKeywords: ["rückgabe", "umtausch", "widerruf", "reklamation", "retoure", "rücksendung", "erstattung", "austausch", "garantie"],
    returnTCKewords: ["agb", "bedingungen", "nutzungsbedingungen", "regeln"],
    returnCustomerServiceKeywords: ["kundenservice", "kontakt", "hilfe", "service"],
    returnPages: ["/rueckgabe", "/umtausch", "/widerruf", "/reklamation", "/retoure", "/ruecksendung", "/erstattung", "/exchange", "/refund"],
    returnCommonUrls: ["/faq", "/agb", "/kontakt", "/hilfe"],
    returnLegalContext: "Widerrufsrecht, 14 Tage Rückgabefrist, BGB (Bürgerliches Gesetzbuch)",
    returnHomeCollectionProviders: ["DHL", "Hermes", "DPD", "UPS", "GLS", "Deutsche Post"],
    returnParcelShops: ["DHL Paketshop", "Hermes Paketshop", "UPS Access Point", "DPD Pickup", "GLS Parcel Shop"],
    returnParcelLockers: ["DHL Packstation", "MyFlexBox", "UPS Access Point"]
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
    hasIslands: true,
    returnFooterLinks: ["retour", "échange", "remboursement", "rétractation", "return", "exchange", "refund"],
    returnFaqKeywords: ["retour", "échange", "remboursement", "rétractation", "retourner", "rembourser", "échanger", "garantie"],
    returnTCKewords: ["conditions générales", "conditions", "règles", "termes"],
    returnCustomerServiceKeywords: ["service client", "contact", "aide", "assistance"],
    returnPages: ["/retour", "/echange", "/remboursement", "/retractation", "/return", "/exchange", "/refund"],
    returnCommonUrls: ["/faq", "/conditions", "/contact", "/aide"],
    returnLegalContext: "Droit de rétractation, 14 jours, Code de la consommation",
    returnHomeCollectionProviders: ["Colissimo", "Chronopost", "DPD", "GLS", "UPS", "Colis Privé", "DHL", "La Poste"],
    returnParcelShops: ["Mondial Relay (InPost)", "Chronopost", "Colissimo", "La Poste branches", "DPD Pickup", "Relais Colis", "GLS Parcel Shop"],
    returnParcelLockers: ["Mondial Relay (InPost)", "Chronopost", "Colissimo"]
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
    hasIslands: true,
    returnFooterLinks: ["reso", "rimborsi", "cambio", "restituzione", "reclamo", "recesso", "return", "refund", "exchange"],
    returnFaqKeywords: ["reso", "rimborsi", "cambio", "restituzione", "reclamo", "recesso", "garanzia"],
    returnTCKewords: ["termini e condizioni", "condizioni", "regole", "norme"],
    returnCustomerServiceKeywords: ["servizio clienti", "contatto", "aiuto", "assistenza"],
    returnPages: ["/reso", "/rimborsi", "/cambio", "/restituzione", "/reclamo", "/recesso", "/return", "/refund", "/exchange"],
    returnCommonUrls: ["/faq", "/termini-e-condizioni", "/contatto", "/aiuto"],
    returnLegalContext: "Diritto di recesso, 14 giorni, Codice del Consumo",
    returnHomeCollectionProviders: ["BRT (Bartolini)", "GLS", "SDA/Poste Italiane", "UPS", "DHL", "FedEx/TNT"],
    returnParcelShops: ["BRT/Fermopoint", "UPS", "Poste Italiane SDA", "Punto Poste", "InPost", "GLS", "TNT/Fedex", "DHL"],
    returnParcelLockers: ["BRT", "InPost", "Punto Poste", "SDA"]
  },
  spain: {
    name: "Spain",
    code: "ES",
    language: "Spanish",
    homeDelivery: ["Correos", "SEUR", "GLS", "DHL", "UPS", "MRW", "Nacex", "Paack"],
    parcelShops: ["Correos/Sucursal", "InPost (Mondial Relay)", "SEUR", "GLS Parcel Shop", "UPS Access Point", "Celeritas"],
    parcelLockers: ["InPost", "SEUR", "Correos - Citipaq", "DHL"],
    shippingPages: ["/envio", "/entrega", "/shipping", "/delivery"],
    footerLinks: ["envío", "entrega", "shipping", "información de envío", "gastos de envío"],
    islands: "Spanish islands like Balearic Islands, Canary Islands, etc.",
    hasIslands: true,
    returnFooterLinks: ["devolución", "reembolso", "cambio", "reclamación", "desistimiento", "return", "refund", "exchange"],
    returnFaqKeywords: ["devolución", "reembolso", "cambio", "reclamación", "desistimiento", "garantía"],
    returnTCKewords: ["términos y condiciones", "condiciones", "reglas", "normas"],
    returnCustomerServiceKeywords: ["atención al cliente", "contacto", "ayuda", "servicio"],
    returnPages: ["/devolucion", "/reembolso", "/cambio", "/reclamacion", "/desistimiento", "/return", "/refund", "/exchange"],
    returnCommonUrls: ["/faq", "/terminos-y-condiciones", "/contacto", "/ayuda"],
    returnLegalContext: "Derecho de desistimiento, 14 días, Ley de Defensa de los Consumidores y Usuarios",
    returnHomeCollectionProviders: ["Correos", "SEUR", "GLS", "DHL", "UPS", "MRW", "Nacex", "Paack"],
    returnParcelShops: ["Correos/Sucursal", "InPost (Mondial Relay)", "SEUR", "GLS Parcel Shop", "UPS Access Point", "Celeritas"],
    returnParcelLockers: ["InPost", "SEUR", "Correos - Citipaq", "DHL"]
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
    hasIslands: false,
    returnFooterLinks: ["zwrot", "wymiana", "reklamacja", "odstąpienie", "return", "refund", "exchange"],
    returnFaqKeywords: ["zwrot", "wymiana", "reklamacja", "odstąpienie", "gwarancja"],
    returnTCKewords: ["regulamin", "warunki", "zasady", "postanowienia"],
    returnCustomerServiceKeywords: ["obsługa klienta", "kontakt", "pomoc", "serwis"],
    returnPages: ["/zwrot", "/wymiana", "/reklamacja", "/odstapienie", "/return", "/refund", "/exchange"],
    returnCommonUrls: ["/faq", "/regulamin", "/kontakt", "/pomoc"],
    returnLegalContext: "Prawo odstąpienia od umowy, 14 dni, Ustawa o prawach konsumenta",
    returnHomeCollectionProviders: ["DPD", "InPost", "DHL", "Poczta Polska", "GLS", "UPS", "Fedex"],
    returnParcelShops: ["InPost", "DPD", "Orlen", "Poczta Polska", "DHL", "GLS Parcel Shop", "UPS"],
    returnParcelLockers: ["InPost", "DPD", "Orlen", "DHL", "Poczta Polska"]
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
    hasIslands: false,
    returnFooterLinks: ["vrácení", "reklamace", "výměna", "odstoupení", "return", "refund", "exchange"],
    returnFaqKeywords: ["vrácení", "reklamace", "výměna", "odstoupení", "záruka"],
    returnTCKewords: ["obchodní podmínky", "podmínky", "pravidla", "ustanovení"],
    returnCustomerServiceKeywords: ["zákaznický servis", "kontakt", "pomoc", "služby"],
    returnPages: ["/vraceni", "/reklamace", "/vymena", "/odstoupeni", "/return", "/refund", "/exchange"],
    returnCommonUrls: ["/faq", "/obchodni-podminky", "/kontakt", "/pomoc"],
    returnLegalContext: "Právo na odstoupení, 14 dní, Občanský zákoník",
    returnHomeCollectionProviders: ["Česká pošta", "PPL", "DPD", "GLS", "Zásilkovna", "DHL", "WEDO", "UPS"],
    returnParcelShops: ["Zásilkovna", "Česká pošta branches", "PPL Parcelshop", "DPD Pickup", "GLS Parcel Shop", "WEDO Points"],
    returnParcelLockers: ["Zásilkovna (Z-Box)", "Česká pošta Balíkovna", "PPL ParcelBox", "DPD Box", "GLS Locker", "AlzaBox", "WEDO Box"]
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
    hasIslands: false,
    returnFooterLinks: ["odstúpenie", "výmena", "reklamácia", "vrátenie", "return", "refund", "exchange"],
    returnFaqKeywords: ["odstúpenie", "výmena", "reklamácia", "vrátenie", "záruka"],
    returnTCKewords: ["obchodné podmienky", "podmienky", "pravidlá", "ustanovenia"],
    returnCustomerServiceKeywords: ["zákaznícky servis", "kontakt", "pomoc", "služby"],
    returnPages: ["/odstapenie", "/vymena", "/reklamacia", "/vracenie", "/return", "/refund", "/exchange"],
    returnCommonUrls: ["/faq", "/obchodne-podmienky", "/kontakt", "/pomoc"],
    returnLegalContext: "Právo na odstúpenie, 14 dní, Občiansky zákonník",
    returnHomeCollectionProviders: ["GLS", "DPD", "SPS/Slovak Parcel Service", "Slovenska Posta", "Packeta", "DHL", "UPS"],
    returnParcelShops: ["GLS", "DPD", "SPS/Slovak Parcel Service", "Slovenska Posta", "Packeta", "DHL", "UPS", "DEPO"],
    returnParcelLockers: ["Packeta (Z-Box)", "Balíkovo/SPS", "Slovenska Posta/BalíkoBOX", "GLS Locker (AlzaBox)", "DPD (AlzaBox)", "AlzaBox", "DEPO"]
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
    hasIslands: false,
    returnFooterLinks: ["întoarcere", "schimb", "reclamare", "înlocuire", "return", "refund", "exchange"],
    returnFaqKeywords: ["întoarcere", "schimb", "reclamare", "înlocuire", "garantie"],
    returnTCKewords: ["termeni și condiții", "condiții", "reguli", "termeni"],
    returnCustomerServiceKeywords: ["serviciu client", "contact", "ajutor", "serviciu"],
    returnPages: ["/intoarcere", "/schimb", "/reclamare", "/inlocuire", "/return", "/refund", "/exchange"],
    returnCommonUrls: ["/faq", "/termeni-si-conditii", "/contact", "/ajutor"],
    returnLegalContext: "Dreptul de retragere, 14 zile, Legea consumatorilor și utilizatorilor",
    returnHomeCollectionProviders: ["Fan Courier", "Cargus", "Sameday", "DPD", "GLS", "Posta Romana", "DHL"],
    returnParcelShops: ["Cargus", "Packeta", "Fan Courier", "DPD", "Posta Romana branch", "GLS Parcel Shop"],
    returnParcelLockers: ["Sameday (Easybox)", "Fan Courier", "Cargus", "Packeta", "GLS", "DPD"]
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
    hasIslands: false,
    returnFooterLinks: ["odstúpenie", "výmena", "reklamácia", "vrátenie", "return", "refund", "exchange"],
    returnFaqKeywords: ["odstúpenie", "výmena", "reklamácia", "vrátenie", "záruka"],
    returnTCKewords: ["obchodné podmienky", "podmienky", "pravidlá", "ustanovenia"],
    returnCustomerServiceKeywords: ["zákaznícky servis", "kontakt", "ajutor", "služba"],
    returnPages: ["/odstapenie", "/vymena", "/reklamacia", "/vracenie", "/return", "/refund", "/exchange"],
    returnCommonUrls: ["/faq", "/obchodne-podmienky", "/kontakt", "/ajutor"],
    returnLegalContext: "Právo na odstúpenie, 14 dní, Občiansky zákonník",
    returnHomeCollectionProviders: ["D Express", "BEX Express", "City Express", "Post Express", "AKS", "GLS"],
    returnParcelShops: ["Post Express/Post branch", "City Express", "AKS"],
    returnParcelLockers: ["D Express", "City Express", "Post Express"]
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
    hasIslands: true,
    returnFooterLinks: ["odstúpenie", "výmena", "reklamácia", "vrátenie", "return", "refund", "exchange"],
    returnFaqKeywords: ["odstúpenie", "výmena", "reklamácia", "vrátenie", "záruka"],
    returnTCKewords: ["obchodné podmienky", "podmienky", "pravidlá", "ustanovenia"],
    returnCustomerServiceKeywords: ["zákaznícky servis", "kontakt", "ajutor", "služba"],
    returnPages: ["/odstapenie", "/vymena", "/reklamacia", "/vracenie", "/return", "/refund", "/exchange"],
    returnCommonUrls: ["/faq", "/obchodne-podmienky", "/kontakt", "/ajutor"],
    returnLegalContext: "Právo na odstúpenie, 14 dní, Občiansky zákonník",
    returnHomeCollectionProviders: ["GLS", "Hrvatska pošta", "DPD", "Overseas Express", "DHL", "UPS", "Gebrüder Weiss", "InTime"],
    returnParcelShops: ["GLS", "Hrvatska pošta", "DPD", "Overseas Express"],
    returnParcelLockers: ["Box Now", "GLS", "Hrvatska pošta", "DPD", "Overseas Express"]
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
    hasIslands: false,
    returnFooterLinks: ["odstúpenie", "výmena", "reklamácia", "vrátenie", "return", "refund", "exchange"],
    returnFaqKeywords: ["odstúpenie", "výmena", "reklamácia", "vrátenie", "záruka"],
    returnTCKewords: ["obchodné podmienky", "podmienky", "pravidlá", "ustanovenia"],
    returnCustomerServiceKeywords: ["zákaznícky servis", "kontakt", "ajutor", "služba"],
    returnPages: ["/odstapenie", "/vymena", "/reklamacia", "/vracenie", "/return", "/refund", "/exchange"],
    returnCommonUrls: ["/faq", "/obchodne-podmienky", "/kontakt", "/ajutor"],
    returnLegalContext: "Právo na odstúpenie, 14 dní, Občiansky zákonník",
    returnHomeCollectionProviders: ["Pošta Slovenije", "GLS", "DPD", "DHL", "UPS", "Express One"],
    returnParcelShops: ["GLS", "Pošta Slovenije", "DPD", "Express One"],
    returnParcelLockers: ["GLS", "Pošta Slovenije", "DPD"]
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
    hasIslands: false,
    returnFooterLinks: ["odstúpenie", "výmena", "reklamácia", "vrátenie", "return", "refund", "exchange"],
    returnFaqKeywords: ["odstúpenie", "výmena", "reklamácia", "vrátenie", "záruka"],
    returnTCKewords: ["obchodné podmienky", "podmienky", "pravidlá", "ustanovenia"],
    returnCustomerServiceKeywords: ["zákaznícky servis", "kontakt", "ajutor", "služba"],
    returnPages: ["/odstapenie", "/vymena", "/reklamacia", "/vracenie", "/return", "/refund", "/exchange"],
    returnCommonUrls: ["/faq", "/obchodne-podmienky", "/kontakt", "/ajutor"],
    returnLegalContext: "Právo na odstúpenie, 14 dní, Občiansky zákonník",
    returnHomeCollectionProviders: ["MPL", "GLS", "DPD", "Express One", "Sprinter (Sameday)", "DHL", "Sameday"],
    returnParcelShops: ["Hungarian Post (MPL)", "GLS", "Packeta", "Pick Pack Pont (Sameday)", "DPD", "Express One"],
    returnParcelLockers: ["Hungarian Post (MPL)", "GLS", "Foxpost", "Packeta Z-Box", "DPD", "Sameday Easybox", "Express One"]
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
    hasIslands: true,
    returnFooterLinks: ["return", "refund", "exchange", "complaint", "return", "exchange", "refund"],
    returnFaqKeywords: ["return", "refund", "exchange", "complaint", "return", "exchange", "refund"],
    returnTCKewords: ["terms and conditions", "conditions", "rules", "terms"],
    returnCustomerServiceKeywords: ["customer service", "contact", "help", "service"],
    returnPages: ["/return", "/refund", "/exchange", "/complaint", "/return", "/exchange", "/refund"],
    returnCommonUrls: ["/faq", "/terms-and-conditions", "/contact", "/help"],
    returnLegalContext: "Right of withdrawal, 14 days, Consumer Rights Act",
    returnHomeCollectionProviders: ["Royal Mail", "DPD", "DHL", "UPS", "Evri", "Yodel", "Fedex", "Parcelforce"],
    returnParcelShops: ["Evri", "Royal Mail", "DPD", "InPost", "UPS", "ASDA", "Yodel", "DHL"],
    returnParcelLockers: ["InPost", "DPD", "Royal Mail", "Evri"]
  }
};

const addReturnFieldsIfMissing = (country) => {
  if (!country.returnFooterLinks) country.returnFooterLinks = [];
  if (!country.returnFaqKeywords) country.returnFaqKeywords = [];
  if (!country.returnTCKewords) country.returnTCKewords = [];
  if (!country.returnCustomerServiceKeywords) country.returnCustomerServiceKeywords = [];
  if (!country.returnPages) country.returnPages = [];
  if (!country.returnCommonUrls) country.returnCommonUrls = [];
  if (!country.returnLegalContext) country.returnLegalContext = "";
  if (!country.returnHomeCollectionProviders) country.returnHomeCollectionProviders = [];
  if (!country.returnParcelShops) country.returnParcelShops = [];
  if (!country.returnParcelLockers) country.returnParcelLockers = [];
};
Object.values(countryData).forEach(addReturnFieldsIfMissing);

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

// --- Return prompt template ---
const returnPromptTemplate = country => `Stagehand tool használatával:

1. Navigate to the homepage of the website: \${website}
2. Search for return information in these locations in ${country.language} for ${country.name}:
    * Footer links: "${(country.returnFooterLinks && country.returnFooterLinks.length > 0) ? country.returnFooterLinks.join('", "') : ''}"
    * FAQ section: search for return/refund/exchange keywords in ${country.language}: ${country.returnFaqKeywords.join(', ')}
    * Terms & Conditions: "${country.returnTCKewords.join('", "')}"
    * Customer service: "${country.returnCustomerServiceKeywords.join('", "')}"
    * Dedicated return pages: ${(country.returnPages && country.returnPages.length > 0) ? country.returnPages.join(', ') : ''}

3. Check these common ${country.language} return page URLs if direct links don't work:
   - ${(country.returnCommonUrls && country.returnCommonUrls.length > 0) ? country.returnCommonUrls.join(', ') : ''}

4. Search strategy:
   - First check homepage for obvious return links in footer/header
   - Navigate to FAQ and search for return-related questions
   - Check dedicated return pages using common URL patterns
   - Look in Terms & Conditions for return policies
   - If no dedicated pages found, check customer service/contact pages
   - If return page returns 404, check FAQ section for return information
   - Try variations of URLs (with/without dashes, different endings)

5. Extract return information from all relevant pages

EXTRACT EXACTLY THESE RETURN CATEGORIES AND DO NOT EXTRACT DELIVERY INFORMATION. DO NOT VISIT LINKS ON EXTERNAL PAGES (e.g. logistics websites) EXTRACT ONLY CONFIRMED INFORMATION:

IN-STORE RETURN:
* Available: yes/no
* Locations: [store locations/cities if available]
* Time limit: [return period - specify in days, e.g., "14 days", "30 days"]
* Conditions: [any specific conditions or requirements]

HOME COLLECTION:
* Available: yes/no
* Providers: [list of courier companies that collect returns such as: ${country.homeDelivery.join(', ')}, etc.]
* Cost: [price information or free collection details - specify who pays: customer or store]
* Time limit: [return period in days]
* Conditions: [booking requirements, packaging conditions]

DROP OFF VIA PARCEL SHOP:
* Available: yes/no
* Providers: [such as: ${country.parcelShops.join(', ')}, etc.]
* Cost: [price information or free drop-off details - specify who pays]
* Time limit: [return period in days]

DROP OFF VIA PARCEL LOCKER:
* Available: yes/no
* Providers: [such as: ${country.parcelLockers.join(', ')}, etc.]
* Cost: [price information or free drop-off details - specify who pays]
* Time limit: [return period in days]

FREE RETURN:
* Available: yes/no
* Conditions: [minimum order value, specific product categories, time limits]
* Methods: [which return methods are free]

QR CODE/BARCODE OR PIN CODE:
* Available: yes/no
* Usage: [how codes are used - for parcel lockers, return portals, etc.]
* Providers: [which services support this feature]

EXTERNAL RETURN PORTAL:
* Available: yes/no
* URL: [return portal website if available]
* Features: [return label generation, status tracking, etc.]

Website: \${website} Country: ${country.code}

Response Format: Return exactly this JSON structure in ENGLISH. If a field is unavailable, write "not available". All strings should be human-readable in English, but preserve original company names and specific terms where relevant.
{
  "website": "\${website}",
  "IN_STORE_RETURN": {
    "available": "yes/no/not available",
    "locations": ["city1", "city2"] or "not available",
    "time_limit": "period in days or not available",
    "conditions": "conditions in English or not available"
  },
  "HOME_COLLECTION": {
    "available": "yes/no/not available",
    "providers": ["provider1", "provider2"] or "not available",
    "cost": "price info in English or not available",
    "time_limit": "period in days or not available",
    "conditions": "conditions in English or not available"
  },
  "DROP_OFF_PARCEL_SHOP": {
    "available": "yes/no/not available",
    "providers": ["provider1", "provider2"] or "not available",
    "cost": "price info in English or not available",
    "time_limit": "period in days or not available"
  },
  "DROP_OFF_PARCEL_LOCKER": {
    "available": "yes/no/not available",
    "providers": ["provider1", "provider2"] or "not available",
    "cost": "price info in English or not available",
    "time_limit": "period in days or not available"
  },
  "FREE_RETURN": {
    "available": "yes/no/not available",
    "conditions": "conditions in English or not available",
    "methods": "methods in English or not available"
  },
  "QR_CODE_BARCODE_PIN": {
    "available": "yes/no/not available",
    "usage": "usage description in English or not available",
    "providers": ["provider1", "provider2"] or "not available"
  },
  "EXTERNAL_RETURN_PORTAL": {
    "available": "yes/no/not available",
    "url": "URL or not available",
    "features": "features in English or not available"
  },
  "SUMMARY": "RETURN METHODS: [List available methods in English]. TIMEFRAME: [Return period]. COSTS: [Who pays and how much]. PROVIDERS: [Logistics partners]. LOCATIONS: [Physical return points]. RESTRICTIONS: [Product exclusions and conditions]. LEGAL BASIS: [Reference to consumer law if mentioned]. WEBSITE QUALITY: [Assessment of information completeness and accessibility]."
}

Additional validation rules:
- For time_limit: Always specify in days (e.g., "14 days", "30 days")
- For cost: Be specific about who pays (e.g., "customer pays", "free of charge")
- For conditions: Include specific packaging requirements in English
- For providers: List actual company names found on site
- Ensure currency is mentioned in EUR if applicable
- Translate legal terms to English but preserve original company names

If something is not available or not found, write "not available".
Only extract information that is explicitly visible on the pages. Do not assume or guess.
All responses must be in English for international analysis purposes.

IMPORTANT: The SUMMARY field should be formatted as a single text string in English that will work well when converted to a table format in Excel/CSV. Use clear section headers and concise descriptions separated by periods and line breaks where appropriate.`;

// --- Fő generálás ---
(async () => {
  console.log('Generating shipping prompts...');
  for (const [key, country] of Object.entries(countryData)) {
    const shippingPrompt = promptTemplate(country);
    const shippingOutPath = path.join(process.cwd(), `prompts/prompt.${key}.txt`);
    await fs.writeFile(shippingOutPath, shippingPrompt, 'utf-8');
    console.log(`Generated: prompts/prompt.${key}.txt`);
  }
  
  console.log('Generating return prompts...');
  for (const [key, country] of Object.entries(countryData)) {
    const returnPrompt = returnPromptTemplate(country);
    const returnOutPath = path.join(process.cwd(), `prompts/prompt-returns.${key}.txt`);
    await fs.writeFile(returnOutPath, returnPrompt, 'utf-8');
    console.log(`Generated: prompts/prompt-returns.${key}.txt`);
  }
  
  console.log('All prompts generated successfully!');
})(); 