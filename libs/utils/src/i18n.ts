
// en_us -> enUS
export const underscoreNamingToCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// enUS -> en_us
export function camelToUnderscore(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

