export const PEDAGOGI_LABELS: Record<string, string> = {
  GIL_HARACH:          "גיל הרך",
  YESODI:              "בי\"ס יסודי",
  TICHON:              "חטיבות ותיכונים",
  CHINUCH_MEYUCHAD:    "חינוך מיוחד",
  SHAFACH:             "שפ\"ח",
  MOVILEI_TECHUM:      "מובילי תחום מדריכות ומפקחים",
  IRIYAT_YERUSHALAIM:  "עיריית ירושלים",
  MANCHI:              "מנח\"י",
  ACHER:               "אחר",
}

export const TAKZIVI_LABELS: Record<string, string> = {
  OVDEI_HORAA:                 "עובדי הוראה",
  MANCHI:                      "מנח\"י",
  IRIYAT_YERUSHALAIM_TASHLUM:  "עיריית ירושלים בתשלום",
  CHUTZNIIOT_TASHLUM:          "סדנאות חיצוניות בתשלום",
}

// Short forms for the pivot grid, where the full labels are far too wide for a
// column header. These are the headings used in the מרכז's own Excel workbook,
// so the exported file reads the way its audience already expects.
export const TAKZIVI_SHORT: Record<string, string> = {
  OVDEI_HORAA:                 "עו\"ה",
  MANCHI:                      "מנח\"י",
  IRIYAT_YERUSHALAIM_TASHLUM:  "עירייה",
  CHUTZNIIOT_TASHLUM:          "חיצוני",
}

export const PEDAGOGI_VALUES = Object.keys(PEDAGOGI_LABELS)
export const TAKZIVI_VALUES  = Object.keys(TAKZIVI_LABELS)
