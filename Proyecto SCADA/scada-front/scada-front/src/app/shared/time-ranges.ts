export type TimeRange =
  | '15m'
  | '30m'
  | '1h'
  | '6h'
  | '12h'
  | '24h'
  | '7d'
  | '1m'
  | '1y';

export const TIME_RANGES = [
  { key: '15m', label: '15min' },
  { key: '30m', label: '30min' },
  { key: '1h',  label: '1h' },
  { key: '6h',  label: '6h' },
  { key: '12h', label: '12h' },
  { key: '24h', label: '1d' },
  { key: '7d',  label: '1sem' },
  { key: '1m',  label: '1m' },
  { key: '1y',  label: '1a' }
] as const;

// CONFIG INTERNA (NO afecta UI)
export const TIME_AXIS_CONFIG: Record<TimeRange, {
  rangeMs: number;
  intervalMs: number;
  showDate: boolean;
}> = {

  '15m': {
    rangeMs: 15 * 60 * 1000,
    intervalMs: 1 * 60 * 1000,
    showDate: false
  },

  '30m': {
    rangeMs: 30 * 60 * 1000,
    intervalMs: 2 * 60 * 1000,
    showDate: false
  },

  '1h': {
    rangeMs: 60 * 60 * 1000,
    intervalMs: 5 * 60 * 1000,
    showDate: false
  },

  '6h': {
    rangeMs: 6 * 60 * 60 * 1000,
    intervalMs: 30 * 60 * 1000,
    showDate: true
  },

  '12h': {
    rangeMs: 12 * 60 * 60 * 1000,
    intervalMs: 60 * 60 * 1000,
    showDate: true
  },

  '24h': {
    rangeMs: 24 * 60 * 60 * 1000,
    intervalMs: 2 * 60 * 60 * 1000,
    showDate: true
  },

  '7d': {
    rangeMs: 7 * 24 * 60 * 60 * 1000,
    intervalMs: 24 * 60 * 60 * 1000,
    showDate: true
  },

  '1m': {
    rangeMs: 30 * 24 * 60 * 60 * 1000,
    intervalMs: 2 * 24 * 60 * 60 * 1000,
    showDate: true
  },

  '1y': {
    rangeMs: 365 * 24 * 60 * 60 * 1000,
    intervalMs: 15 * 24 * 60 * 60 * 1000,
    showDate: true
  }
};