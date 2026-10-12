/** Kenya's 47 counties grouped into Waterlift Solar recruitment regions. */
export const REGIONS = {
  "Nairobi & South Eastern": ["Nairobi", "Kiambu", "Machakos", "Kajiado", "Kitui", "Makueni"],
  "Mt Kenya": ["Nyeri", "Murang'a", "Kirinyaga", "Nyandarua", "Laikipia", "Meru", "Tharaka-Nithi", "Embu"],
  Coast: ["Mombasa", "Kwale", "Kilifi", "Taita-Taveta", "Tana River", "Lamu"],
  "Frontier & North Eastern": ["Garissa", "Wajir", "Mandera", "Isiolo", "Marsabit", "Samburu"],
  "North Rift": ["Turkana", "West Pokot", "Trans Nzoia", "Uasin Gishu", "Elgeyo-Marakwet", "Nandi", "Baringo"],
  "South Rift": ["Nakuru", "Narok", "Bomet", "Kericho"],
  "Lake & Western": ["Kisumu", "Siaya", "Homa Bay", "Migori", "Kisii", "Nyamira", "Kakamega", "Vihiga", "Bungoma", "Busia"],
} as const satisfies Record<string, readonly string[]>;

export type Region = keyof typeof REGIONS;
export type County = (typeof REGIONS)[Region][number];

export const REGION_NAMES = Object.keys(REGIONS) as Region[];
export const COUNTIES = (Object.values(REGIONS).flat() as County[]).sort((a, b) => a.localeCompare(b));

export function isCounty(value: string): value is County {
  return (COUNTIES as readonly string[]).includes(value);
}

export function regionOf(county: County): Region {
  return REGION_NAMES.find((r) => (REGIONS[r] as readonly string[]).includes(county))!;
}

/** "Murang'a" → "MUR", used in application references like MUR-T2-0007. */
export function countyCode(county: string): string {
  return county.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "KEN";
}
