import * as estadosData from '../../../assets/data/estados.json';

/**
 * Why this approach?
 * 1. Single Source of Truth: Uses your 'estados.json' as the master reference.
 * 2. Scalability: Easy to add the remaining municipalities for the 520 sites.
 * 3. Type Safety: TypeScript will prevent typos in municipality names across the app.
 */

// Accessing the Edomex (ID 15) municipality dictionary
const edomexDict = (estadosData as any).default["15"].municipios;

export const PHASE_1_MUNICIPALITIES = [
  edomexDict["25"],  // CHALCO
  edomexDict["33"],  // ECATEPEC DE MORELOS
  edomexDict["99"], // TEXCOCO
  edomexDict["104"], // TLALNEPANTLA DE BAZ
  edomexDict["29"],  // CHICOLOAPAN
  edomexDict["39"],  // IXTAPALUCA
  edomexDict["31"],  // CHIMALHUACAN
  edomexDict["58"],  // NEZAHUALCOYOTL
  edomexDict["122"], // VALLE DE CHALCO SOLIDARIDAD
  edomexDict["70"]   // LA PAZ
] as const;

// Strict type for Phase 1
export type ProjectMunicipality = typeof PHASE_1_MUNICIPALITIES[number];

// Utility to get the full Edomex catalog if needed for search/filters
export const ALL_EDOMEX_MUNICIPALITIES = Object.values(edomexDict) as string[];