export const carriers = {
  WEDO: {
    name: "WEDO",
    logoUrl: "https://dl.memuplay.com/new_market/img/cz.wedo.receiverapp.icon.2022-11-26-09-45-30.png",
    supportedCountries: ["CZ"],
    services: [{
      name: "Doručení na vaši adresu",
      shipmentType: "balik",
      pricePerUnit: 129
    }]
  },
  CP: {
    name: "Česká pošta",
    logoUrl: "https://www.cernydul.cz/data/galerie/posta.jpg",
    supportedCountries: ["CZ"],
    services: [{
      name: "Balík do ruky",
      shipmentType: "balik",
      pricePerUnit: 139
    }]
  },
  GLS: {
    name: "GLS",
    logoUrl: "https://gls-group.com/CZ/media/images/logo_thumb_M02_ASIDE.png",
    supportedCountries: ["CZ"],
    services: [{
      name: "Nadrozměrná doprava XXL",
      shipmentType: "balik",
      pricePerUnit: 299
    }]
  },
  GEIS: {
    name: "GEIS",
    logoUrl: "https://www.geis-group.cz/archiv/content_cs/logo-geis-global-logistic-cmyk.png",
    supportedCountries: ["CZ"],
    services: [{
      name: "Paletová doprava nábytku",
      shipmentType: "paleta",
      pricePerUnit: 999
    }]
  },
  QDL: {
    name: "QDL",
    logoUrl: "https://www.qdl.sk/wp-content/uploads/2025/01/1Asset-133013.png",
    supportedCountries: ["SK"],
    services: [{
      name: "B2B - Slovensko",
      shipmentType: "balik",
      pricePerUnit: 249
    }]
  },
  SDS: {
    name: "SDS",
    logoUrl: "https://www.recenzer.cz/wp-content/uploads/2024/01/sds.jpg",
    supportedCountries: ["SK"],
    services: [{
      name: "B2B - Nadrozměr - Slovensko",
      shipmentType: "paleta",
      pricePerUnit: 1499
    }]
  }
};
