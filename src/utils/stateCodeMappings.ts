/**
 * Mappings from GeoNames admin1 codes to standard 2-letter state/province codes
 * GeoNames uses FIPS codes or custom codes, we need to map them to postal abbreviations
 */

// US States: GeoNames uses FIPS codes, we need postal abbreviations
export const US_ADMIN_TO_STATE: Record<string, string> = {
  'AL': 'AL', // Alabama
  'AK': 'AK', // Alaska
  'AZ': 'AZ', // Arizona
  'AR': 'AR', // Arkansas
  'CA': 'CA', // California
  'CO': 'CO', // Colorado
  'CT': 'CT', // Connecticut
  'DE': 'DE', // Delaware
  'FL': 'FL', // Florida
  'GA': 'GA', // Georgia
  'HI': 'HI', // Hawaii
  'ID': 'ID', // Idaho
  'IL': 'IL', // Illinois
  'IN': 'IN', // Indiana
  'IA': 'IA', // Iowa
  'KS': 'KS', // Kansas
  'KY': 'KY', // Kentucky
  'LA': 'LA', // Louisiana
  'ME': 'ME', // Maine
  'MD': 'MD', // Maryland
  'MA': 'MA', // Massachusetts
  'MI': 'MI', // Michigan
  'MN': 'MN', // Minnesota
  'MS': 'MS', // Mississippi
  'MO': 'MO', // Missouri
  'MT': 'MT', // Montana
  'NE': 'NE', // Nebraska
  'NV': 'NV', // Nevada
  'NH': 'NH', // New Hampshire
  'NJ': 'NJ', // New Jersey
  'NM': 'NM', // New Mexico
  'NY': 'NY', // New York
  'NC': 'NC', // North Carolina
  'ND': 'ND', // North Dakota
  'OH': 'OH', // Ohio
  'OK': 'OK', // Oklahoma
  'OR': 'OR', // Oregon
  'PA': 'PA', // Pennsylvania
  'RI': 'RI', // Rhode Island
  'SC': 'SC', // South Carolina
  'SD': 'SD', // South Dakota
  'TN': 'TN', // Tennessee
  'TX': 'TX', // Texas
  'UT': 'UT', // Utah
  'VT': 'VT', // Vermont
  'VA': 'VA', // Virginia
  'WA': 'WA', // Washington
  'WV': 'WV', // West Virginia
  'WI': 'WI', // Wisconsin
  'WY': 'WY', // Wyoming
  'DC': 'DC', // District of Columbia
};

// Canadian Provinces
export const CA_ADMIN_TO_STATE: Record<string, string> = {
  '01': 'AB', // Alberta
  '02': 'BC', // British Columbia
  '03': 'MB', // Manitoba
  '04': 'NB', // New Brunswick
  '05': 'NL', // Newfoundland and Labrador
  '13': 'NT', // Northwest Territories
  '07': 'NS', // Nova Scotia
  '14': 'NU', // Nunavut
  '08': 'ON', // Ontario
  '09': 'PE', // Prince Edward Island
  '10': 'QC', // Quebec
  '11': 'SK', // Saskatchewan
  '12': 'YT', // Yukon
};

// Australian States
export const AU_ADMIN_TO_STATE: Record<string, string> = {
  '01': 'ACT', // Australian Capital Territory
  '02': 'NSW', // New South Wales
  '03': 'NT',  // Northern Territory
  '04': 'QLD', // Queensland
  '05': 'SA',  // South Australia
  '06': 'TAS', // Tasmania
  '07': 'VIC', // Victoria
  '08': 'WA',  // Western Australia
};

// Brazilian States
export const BR_ADMIN_TO_STATE: Record<string, string> = {
  '01': 'AC', // Acre
  '02': 'AL', // Alagoas
  '03': 'AP', // Amapá
  '04': 'AM', // Amazonas
  '05': 'BA', // Bahia
  '06': 'CE', // Ceará
  '07': 'DF', // Distrito Federal
  '08': 'ES', // Espírito Santo
  '29': 'GO', // Goiás
  '10': 'MA', // Maranhão
  '11': 'MT', // Mato Grosso
  '12': 'MS', // Mato Grosso do Sul
  '13': 'MG', // Minas Gerais
  '14': 'PA', // Pará
  '15': 'PB', // Paraíba
  '18': 'PR', // Paraná
  '16': 'PE', // Pernambuco
  '17': 'PI', // Piauí
  '19': 'RJ', // Rio de Janeiro
  '20': 'RN', // Rio Grande do Norte
  '21': 'RS', // Rio Grande do Sul
  '22': 'RO', // Rondônia
  '23': 'RR', // Roraima
  '24': 'SC', // Santa Catarina
  '25': 'SP', // São Paulo
  '26': 'SE', // Sergipe
  '27': 'TO', // Tocantins
};

// Indian States (using GeoNames admin1 codes mapped to postal abbreviations)
// Note: GeoNames uses numeric codes for Indian states
export const IN_ADMIN_TO_STATE: Record<string, string> = {
  '28': 'AP', // Andhra Pradesh
  '37': 'AR', // Arunachal Pradesh
  '03': 'AS', // Assam
  '34': 'BR', // Bihar
  '26': 'CT', // Chhattisgarh
  '09': 'GA', // Goa
  '29': 'GJ', // Gujarat
  '06': 'HR', // Haryana
  '08': 'HP', // Himachal Pradesh
  '38': 'JK', // Jammu and Kashmir
  '20': 'JH', // Jharkhand
  '19': 'KA', // Karnataka
  '13': 'KL', // Kerala
  '35': 'LD', // Lakshadweep
  '23': 'MP', // Madhya Pradesh
  '22': 'MH', // Maharashtra
  '14': 'MN', // Manipur
  '17': 'ML', // Meghalaya
  '15': 'MZ', // Mizoram
  '12': 'NL', // Nagaland
  '21': 'OR', // Odisha
  '27': 'PY', // Puducherry
  '30': 'PB', // Punjab
  '24': 'RJ', // Rajasthan
  '11': 'SK', // Sikkim
  '33': 'TN', // Tamil Nadu
  '36': 'TG', // Telangana
  '16': 'TR', // Tripura
  '39': 'UP', // Uttar Pradesh
  '40': 'UT', // Uttarakhand
  '41': 'WB', // West Bengal
  '07': 'DL', // Delhi
};

// Mexican States
export const MX_ADMIN_TO_STATE: Record<string, string> = {
  '01': 'AG', // Aguascalientes
  '02': 'BC', // Baja California
  '03': 'BS', // Baja California Sur
  '04': 'CM', // Campeche
  '05': 'CO', // Coahuila
  '06': 'CL', // Colima
  '07': 'CS', // Chiapas
  '08': 'CH', // Chihuahua
  '09': 'DF', // Ciudad de México
  '10': 'DG', // Durango
  '11': 'GT', // Guanajuato
  '12': 'GR', // Guerrero
  '13': 'HG', // Hidalgo
  '14': 'JA', // Jalisco
  '15': 'MX', // México
  '16': 'MI', // Michoacán
  '17': 'MO', // Morelos
  '18': 'NA', // Nayarit
  '19': 'NL', // Nuevo León
  '20': 'OA', // Oaxaca
  '21': 'PU', // Puebla
  '22': 'QT', // Querétaro
  '23': 'QR', // Quintana Roo
  '24': 'SL', // San Luis Potosí
  '25': 'SI', // Sinaloa
  '26': 'SO', // Sonora
  '27': 'TB', // Tabasco
  '28': 'TM', // Tamaulipas
  '29': 'TL', // Tlaxcala
  '30': 'VE', // Veracruz
  '31': 'YU', // Yucatán
  '32': 'ZA', // Zacatecas
};

/**
 * Get mapping for a specific country
 */
export function getStateCodeMapping(countryCode: string): Record<string, string> | null {
  switch (countryCode) {
    case 'US':
      return US_ADMIN_TO_STATE;
    case 'CA':
      return CA_ADMIN_TO_STATE;
    case 'AU':
      return AU_ADMIN_TO_STATE;
    case 'BR':
      return BR_ADMIN_TO_STATE;
    case 'IN':
      return IN_ADMIN_TO_STATE;
    case 'MX':
      return MX_ADMIN_TO_STATE;
    default:
      return null;
  }
}
