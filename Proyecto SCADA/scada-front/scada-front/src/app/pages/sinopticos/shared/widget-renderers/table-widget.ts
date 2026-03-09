import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

interface TableColumn {
  devEUI: string;
  measurement: string;
  label: string;
  unit: string;
  source?: 'tag' | 'view';
  viewId?: number;
  formulaId?: number;
  formulaAlias?: string;
}

interface TableConfig {
  columns: TableColumn[];
  showHeader: boolean;
  striped: boolean;
}

@Component({
  selector: 'widget-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-widget" [class.striped]="cfg().striped">
      <table *ngIf="cfg().columns.length > 0">
        <thead *ngIf="cfg().showHeader !== false">
          <tr>
            <th *ngFor="let col of cfg().columns">
              {{ col.label || col.measurement }}
              <span class="th-unit" *ngIf="col.unit">({{ col.unit }})</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td *ngFor="let col of cfg().columns" class="cell-value" [class.cell-stale]="isCellStale(col)">
              {{ getCellValue(col) }}
            </td>
          </tr>
        </tbody>
      </table>
      <div class="table-placeholder" *ngIf="cfg().columns.length === 0">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
        <span>Configura columnas</span>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .table-widget {
        width: 100%;
        height: 100%;
        overflow: auto;
        background: var(--bg-card);
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th {
        padding: 8px 12px;
        text-align: left;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: var(--table-header-bg);
        border-bottom: 2px solid var(--border-strong);
        position: sticky;
        top: 0;
      }
      .th-unit {
        font-weight: 400;
        text-transform: none;
        letter-spacing: normal;
        color: var(--text-muted);
      }
      td {
        padding: 8px 12px;
        border-bottom: 1px solid var(--border-default);
        color: var(--text-primary);
      }
      .striped tbody tr:nth-child(even) td {
        background: var(--bg-card-hover);
      }
      .cell-value {
        font-family: ui-monospace, monospace;
      }
      .cell-stale {
        color: #f59e0b;
        font-style: italic;
      }
      .table-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 8px;
        color: var(--text-muted);
        font-size: 12px;
      }
    `,
  ],
})
export class TableWidget {
  cfg = input.required<TableConfig>({ alias: 'config' });

  /** Live values keyed by "devEUI::measurement" */
  liveValues = input<Record<string, any>>({});

  isCellStale(col: TableColumn): boolean {
    if (col.source === 'view') return false;
    const { devEUI, measurement } = col;
    if (!devEUI || !measurement) return false;
    const key = `${devEUI}::${measurement}`;
    const entry = this.liveValues()[key];
    if (!entry?.last_updated_at) return false;
    const diff = Date.now() - new Date(entry.last_updated_at).getTime();
    return diff > 15 * 60 * 1000; // 15 minutes
  }

  getCellValue(col: TableColumn): string {
    // View formula source: look up by view:viewId:formula:formulaId key
    if (col.source === 'view' && col.viewId && col.formulaId) {
      const key = `view:${col.viewId}:formula:${col.formulaId}`;
      const entry = this.liveValues()[key];
      const val = entry?.value ?? null;
      return val !== null ? Number(val).toFixed(2) : '--';
    }

    // Original raw-tag lookup
    const { devEUI, measurement } = col;
    if (!devEUI || !measurement) return '--';
    const key = `${devEUI}::${measurement}`;
    const entry = this.liveValues()[key];
    if (!entry) return '--';

    const fieldMap: Record<string, string> = {
      caudal_lts: 'last_flow_value',
      presion_kg: 'last_pressure_value',
      last_total_flow: 'last_total_flow',
      nivel_m: 'last_nivel_value',
      lluvia_mm: 'last_lluvia_value',
      rssi: 'rssi',
      snr: 'snr',
      battery: 'battery_level',
      value_presion: 'last_pressure_value',
      value_caudal: 'last_flow_value',
      value_caudal_totalizado: 'last_total_flow',
      value_senal: 'rssi',
      value_nivel: 'last_nivel_value',
      value_lluvia: 'last_lluvia_value',
    };

    const field = fieldMap[measurement] || measurement;
    const val = entry[field] ?? entry[measurement];
    if (val === null || val === undefined) return '--';
    return typeof val === 'number' ? val.toFixed(2) : String(val);
  }
}
