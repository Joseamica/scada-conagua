// core/models/site.model.ts
import { ProjectMunicipality } from './locations.model';

export interface TelemetrySite {
  id: string;
  name: string;
  municipality: ProjectMunicipality;
  coordinates: {
    lat: number;
    lng: number;
  };
  // Hardware specific for CONAGUA (LoRaWAN / 4G)
  connectionType: 'LoRaWAN' | 'LTE';
}