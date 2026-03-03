import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PozosStore {

  // 🔹 Lista base de pozos destacados / activos
  private _highlightWells = signal<string[]>([

      // Pozos Ecatepec
    'POZO 318 "CALLE 35"',
    'POZO 9 GUAYMAS',
    'POZO 334 JARDINES DE CASA NUEVA 1',
    'POZO 354 ECATEPEC 2',
    'POZO 342 SAN MARTÍN DE PORRES',
    'POZO 21 LA VELETA',
    'POZO 346 CARMEN SERDÁN',
    'POZO 338 CALLE NIEVE',
    'POZO 314 LLANO DE MORELOS',
    'POZO 1 SALESIANOS',
    'POZO 30 LÁZARO CÁRDENAS',
    'POZO 348 RIO DE LUZ',
    'POZO 322 CHICONAUTLA',
    'POZO ABEL MARTÍNEZ MONTANEZ',
    'POZO 324 FOVISSSTE',
    'POZO IZCALLI JARDINES',
    'POZO AYOTZINGO',
    'POZO 12 CASERIO',
    'POZO 10 CHALCO',
    'POZO 11 CHALCO',
    'POZO XICO NUEVO',
    'POZO 13 CHIMALPA 2',
    'POZO HACIENDA GUADALUPE',
    'POZO HACIENDA SAN JUAN',
    'POZO 14 AYOTZINGO 2',
    'POZO 8 CHALCO',
    'POZO 40 IXTAPALUCA',
    'POZO 1 IXTAPALUCA',
    'POZO 49 IXTAPALUCA',
    'POZO 21 IXTAPALUCA',
    'POZO 5 IXTAPALUCA',
    'POZO 37 IXTAPALUCA',
    'POZO 42 IXTAPALUCA',
    'POZO 24 IXTAPALUCA',
    'POZO 25 IXTAPALUCA',
    'POZO 32 IXTAPALUCA',
    'POZO 30 IXTAPALUCA',
    'POZO 50 IXTAPALUCA',
    'POZO 13 IXTAPALUCA',
    'POZO 35 IXTAPALUCA',
    'POZO 34 IXTAPALUCA',
    'POZO 36 IXTAPALUCA',
    'POZO 12 IXTAPALUCA',
    'POZO 39 IXTAPALUCA',
    'POZO 44 IXTAPALUCA',
    'POZO 16 IXTAPALUCA',
    'SITIO PILOTO 4PT',
    'SITIO PILOTO ICH',
    
  ]);

  highlightWells = this._highlightWells.asReadonly();

  // 🔹 Si luego vienen de API
  setHighlightWells(wells: string[]) {
    this._highlightWells.set(wells);
  }
}