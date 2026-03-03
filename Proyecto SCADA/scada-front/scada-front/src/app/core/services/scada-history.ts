import { Injectable } from '@angular/core';
import { TimeRange } from '../../../app/shared/time-ranges';

@Injectable({ providedIn: 'root' })
export class ScadaHistoryService {

  getRangeParams(range: TimeRange){
    const now = Date.now();

    switch(range){
      case '15m': return { from: now - 15*60_000, interval: '10s' };
      case '30m': return { from: now - 30*60_000, interval: '30s' };
      case '1h':  return { from: now - 60*60_000, interval: '1m' };
      case '6h':  return { from: now - 6*60*60_000, interval: '5m' };
      case '12h': return { from: now - 12*60*60_000, interval: '10m' };
      case '24h': return { from: now - 24*60*60_000, interval: '15m' };
      case '7d':  return { from: now - 7*24*60*60_000, interval: '1h' };
      case '1m':  return { from: now - 30*24*60*60_000, interval: '6h' };
      case '1y':  return { from: now - 365*24*60*60_000, interval: '1d' };
    }
  }

  getFlowHistory(pozoId: string, range: TimeRange){
    const params = this.getRangeParams(range);
    // aquí irá la llamada real a API / Rapid SCADA / SQL
    return params;
  }

  getPressureHistory(pozoId: string, range: TimeRange){
    const params = this.getRangeParams(range);
    return params;
  }
}