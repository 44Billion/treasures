/**
 * Convert ISO 3166-1 alpha-2 country code to flag emoji
 * This works by converting the country code letters to regional indicator symbols
 */
export function countryToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) {
    return '';
  }

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}
