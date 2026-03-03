import type { ResolvedTheme } from '../services/theme.service';

export interface EChartsThemeColors {
  backgroundColor: string;
  textColor: string;
  subtextColor: string;
  axisLine: string;
  splitLine: string;
  tooltip: { bg: string; border: string; textColor: string };
}

const LIGHT: EChartsThemeColors = {
  backgroundColor: '#ffffff',
  textColor: '#334155',
  subtextColor: '#94a3b8',
  axisLine: '#e2e8f0',
  splitLine: '#f1f5f9',
  tooltip: { bg: '#ffffff', border: '#e2e8f0', textColor: '#334155' },
};

const DARK: EChartsThemeColors = {
  backgroundColor: '#1e293b',
  textColor: '#f1f5f9',
  subtextColor: '#64748b',
  axisLine: '#475569',
  splitLine: '#334155',
  tooltip: { bg: '#0f172a', border: '#334155', textColor: '#f1f5f9' },
};

export function getEChartsColors(theme: ResolvedTheme): EChartsThemeColors {
  return theme === 'dark' ? DARK : LIGHT;
}

/**
 * Apply theme colors to an existing ECharts option object.
 * Mutates and returns the option for convenience.
 */
export function applyEChartsTheme(
  option: Record<string, any>,
  theme: ResolvedTheme,
): Record<string, any> {
  const c = getEChartsColors(theme);

  option['backgroundColor'] = c.backgroundColor;

  if (option['tooltip']) {
    option['tooltip'] = {
      ...option['tooltip'],
      backgroundColor: c.tooltip.bg,
      borderColor: c.tooltip.border,
      textStyle: { ...option['tooltip']?.textStyle, color: c.tooltip.textColor },
    };
  }

  // xAxis / yAxis — handle array or single object
  for (const axis of ['xAxis', 'yAxis']) {
    const ax = option[axis];
    if (!ax) continue;
    const items = Array.isArray(ax) ? ax : [ax];
    for (const item of items) {
      if (item.axisLine) {
        item.axisLine = { ...item.axisLine, lineStyle: { ...item.axisLine.lineStyle, color: c.axisLine } };
      }
      if (item.splitLine) {
        item.splitLine = { ...item.splitLine, lineStyle: { ...item.splitLine.lineStyle, color: c.splitLine } };
      }
      if (item.axisLabel) {
        item.axisLabel = { ...item.axisLabel, color: c.subtextColor };
      }
    }
  }

  return option;
}
