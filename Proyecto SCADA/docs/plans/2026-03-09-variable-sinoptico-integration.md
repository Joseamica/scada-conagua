# Variable Views ↔ Sinopticos Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow sinoptico widgets (Label, Chart, Table) to bind to variable view formulas in addition to raw tags, enabling computed/derived values on the canvas.

**Architecture:** Extend the existing Tag Browser with a "Mis Vistas" section that lists the user's variable views and their formulas. When a formula is selected, the widget stores a `source: 'view'` + `viewId` + `formulaId` in its config. The backend resolves formula values during the batch query, and SinopticoDataStore handles both raw-tag and view-formula sources transparently. A new endpoint provides historical formula series for charts.

**Tech Stack:** Angular 21 (signals, standalone), Express 4, PostgreSQL, InfluxDB, expr-eval, ECharts 6

---

## File Index

| File | Path | Action |
|------|------|--------|
| `sinoptico.service.ts` | `scada-front/src/app/core/services/sinoptico.service.ts` | EDIT — extend configs |
| `variable.service.ts` | `scada-front/src/app/core/services/variable.service.ts` | EDIT — add methods |
| `tag-browser.ts` | `scada-front/src/app/pages/sinopticos/shared/tag-browser/tag-browser.ts` | EDIT — add Mis Vistas section |
| `tag-browser.html` | `scada-front/src/app/pages/sinopticos/shared/tag-browser/tag-browser.html` | EDIT — add Mis Vistas UI |
| `tag-browser.css` | `scada-front/src/app/pages/sinopticos/shared/tag-browser/tag-browser.css` | EDIT — add styles |
| `sinoptico-editor.ts` | `scada-front/src/app/pages/sinopticos/sinoptico-editor/sinoptico-editor.ts` | EDIT — handle formula selection |
| `sinoptico-data-store.ts` | `scada-front/src/app/pages/sinopticos/sinoptico-editor/store/sinoptico-data-store.ts` | EDIT — resolve view sources |
| `label-widget.ts` | `scada-front/src/app/pages/sinopticos/shared/widget-renderers/label-widget.ts` | NO CHANGE — already generic |
| `chart-widget.ts` | `scada-front/src/app/pages/sinopticos/shared/widget-renderers/chart-widget.ts` | NO CHANGE — already generic |
| `table-widget.ts` | `scada-front/src/app/pages/sinopticos/shared/widget-renderers/table-widget.ts` | EDIT — support formula rows |
| `sinoptico-routes.ts` | `scada-query-api/src/routes/sinoptico-routes.ts` | EDIT — resolve formulas in query |
| `variable-routes.ts` | `scada-query-api/src/routes/variable-routes.ts` | EDIT — add execute-series |
| `formula-engine.ts` | `scada-query-api/src/services/formula-engine.ts` | NO CHANGE — already complete |

---

## Key Design Decisions

1. **TagSelection extended, not replaced.** Adding `source`, `viewId`, `formulaId`, `formulaAlias` as optional fields keeps backward compat with existing raw-tag usage.

2. **Config interfaces extended with `source` discriminator.** `source: 'tag'` (default) = current behavior. `source: 'view'` = formula-resolved value. Widget renderers don't need to know the source — they just receive values.

3. **Backend resolves formulas server-side.** The `POST /sinopticos/:id/query` endpoint already collects devEUI pairs from widgets. We extend it to also detect `source: 'view'` widgets, load their view columns, fetch the raw data, and evaluate formulas. The response key becomes `view:${viewId}:formula:${formulaId}` for formula values.

4. **Chart historical data for formulas** uses a new endpoint `POST /variables/views/:id/execute-series` that returns time-bucketed formula values by querying InfluxDB historical data per column, then evaluating the formula at each timestamp.

5. **Table widget extended for formula rows.** A table column with `source: 'view'` shows the formula's computed value instead of a raw measurement.

---

## Task 1: Extend TagSelection and Widget Config Interfaces

**Files:**
- Modify: `scada-front/src/app/pages/sinopticos/shared/tag-browser/tag-browser.ts` (line 1-8, TagSelection interface)
- Modify: `scada-front/src/app/core/services/sinoptico.service.ts` (lines 60-95, config interfaces)

### Step 1: Extend TagSelection interface

In `tag-browser.ts`, change:

```typescript
export interface TagSelection {
  devEUI: string;
  measurement: string;
  siteName: string;
  municipality: string;
  // New fields for variable view formulas
  source?: 'tag' | 'view';
  viewId?: number;
  formulaId?: number;
  formulaAlias?: string;
}
```

### Step 2: Extend LabelConfig in sinoptico.service.ts

Add optional fields after existing ones:

```typescript
export interface LabelConfig {
  devEUI: string;
  measurement: string;
  title: string;
  unit: string;
  decimals: number;
  fontSize: number;
  alarmRanges: { min: number; max: number; color: string; blink: boolean; textColor?: string }[];
  // Variable view integration
  source?: 'tag' | 'view';
  viewId?: number;
  formulaId?: number;
  formulaAlias?: string;
}
```

### Step 3: Extend ChartConfig series items

```typescript
// Inside ChartConfig.series[]
{
  devEUI: string;
  measurement: string;
  label: string;
  color: string;
  lineType: 'line' | 'bar' | 'area';
  yAxisIndex: number;
  // Variable view integration
  source?: 'tag' | 'view';
  viewId?: number;
  formulaId?: number;
  formulaAlias?: string;
}
```

### Step 4: Extend TableConfig columns

```typescript
// Inside TableConfig.columns[]
{
  devEUI: string;
  measurement: string;
  label: string;
  unit: string;
  // Variable view integration
  source?: 'tag' | 'view';
  viewId?: number;
  formulaId?: number;
  formulaAlias?: string;
}
```

### Step 5: Verify build

Run: `cd "Proyecto SCADA/scada-front/scada-front" && npx ng build --configuration development 2>&1 | tail -5`

Expected: Build succeeds (new fields are optional, no breaking changes).

### Step 6: Commit

```bash
git add -A
git commit -m "feat(sinopticos): extend TagSelection and widget configs for variable view sources"
```

---

## Task 2: Add Variable View Methods to variable.service.ts

**Files:**
- Modify: `scada-front/src/app/core/services/variable.service.ts`

### Step 1: Add getMyViews method

After the existing `getViews()` method, add:

```typescript
getMyViews(): Observable<VariableView[]> {
  return this.http.get<VariableView[]>(`${this.base}/views?mine=true`);
}

getViewDetail(viewId: number): Observable<VariableViewDetail> {
  return this.http.get<VariableViewDetail>(`${this.base}/views/${viewId}`);
}

executeViewSeries(viewId: number, formulaId: number, range: string): Observable<FormulaSeriesResult> {
  return this.http.post<FormulaSeriesResult>(`${this.base}/views/${viewId}/execute-series`, {
    formulaId,
    range,
  });
}
```

### Step 2: Add FormulaSeriesResult interface

```typescript
export interface FormulaSeriesResult {
  formulaId: number;
  alias: string;
  data: [number, number][];  // [timestamp_ms, value]
}
```

### Step 3: Add VariableViewDetail interface if missing

```typescript
export interface VariableViewDetail {
  view: VariableView;
  columns: ViewColumn[];
  formulas: ViewFormula[];
}
```

### Step 4: Add `mine=true` support to backend GET /views

In `variable-routes.ts`, in the `GET /views` handler, add filtering:

```typescript
// After existing query
if (req.query.mine === 'true') {
  query += ' AND vv.owner_id = $' + (params.length + 1);
  params.push(userId);
}
```

### Step 5: Verify build

Run: `cd "Proyecto SCADA/scada-front/scada-front" && npx ng build --configuration development 2>&1 | tail -5`

### Step 6: Commit

```bash
git add -A
git commit -m "feat(variables): add getMyViews, getViewDetail, executeViewSeries to variable service"
```

---

## Task 3: Extend Tag Browser with "Mis Vistas" Section

**Files:**
- Modify: `scada-front/src/app/pages/sinopticos/shared/tag-browser/tag-browser.ts`
- Modify: `scada-front/src/app/pages/sinopticos/shared/tag-browser/tag-browser.html`
- Modify: `scada-front/src/app/pages/sinopticos/shared/tag-browser/tag-browser.css`

### Step 1: Add view loading to tag-browser.ts

Add new signals and load method:

```typescript
private variableService = inject(VariableService);

views = signal<VariableView[]>([]);
expandedViews = signal<Set<number>>(new Set());
viewDetails = signal<Map<number, VariableViewDetail>>(new Map());

loadViews(): void {
  this.variableService.getMyViews().subscribe({
    next: (views) => this.views.set(views),
    error: () => this.views.set([]),
  });
}
```

Call `loadViews()` alongside `loadTags()` in `ngOnInit`.

### Step 2: Add toggleView method

```typescript
toggleView(viewId: number): void {
  const expanded = new Set(this.expandedViews());
  if (expanded.has(viewId)) {
    expanded.delete(viewId);
  } else {
    expanded.add(viewId);
    // Load detail if not cached
    if (!this.viewDetails().has(viewId)) {
      this.variableService.getViewDetail(viewId).subscribe({
        next: (detail) => {
          const map = new Map(this.viewDetails());
          map.set(viewId, detail);
          this.viewDetails.set(map);
        },
      });
    }
  }
  this.expandedViews.set(expanded);
}
```

### Step 3: Add selectFormula method

```typescript
selectFormula(view: VariableView, formula: ViewFormula): void {
  this.tagSelect.emit({
    devEUI: '',
    measurement: '',
    siteName: view.name,
    municipality: 'Vista',
    source: 'view',
    viewId: view.id,
    formulaId: formula.id,
    formulaAlias: formula.alias,
  });
  this.isOpen.set(false);
}

selectViewColumn(view: VariableView, column: ViewColumn): void {
  this.tagSelect.emit({
    devEUI: column.dev_eui,
    measurement: column.measurement,
    siteName: view.name,
    municipality: 'Vista',
    source: 'tag',  // column is just a raw tag with an alias
  });
  this.isOpen.set(false);
}
```

### Step 4: Add HTML for Mis Vistas section

After the existing tag tree in `tag-browser.html`, add a separator and views section:

```html
<!-- Separator -->
<div class="tag-separator" *ngIf="views().length">
  <span class="separator-label">Mis Vistas</span>
</div>

<!-- Views list -->
<div class="view-node" *ngFor="let view of views()">
  <div class="view-header" (click)="toggleView(view.id)">
    <ng-icon [name]="expandedViews().has(view.id) ? 'heroChevronDown' : 'heroChevronRight'" size="14" />
    <ng-icon name="heroVariable" size="16" class="view-icon" />
    <span class="view-name">{{ view.name }}</span>
    <span class="view-badge">{{ view.formula_count }}f</span>
  </div>

  <div class="view-children" *ngIf="expandedViews().has(view.id)">
    <!-- Loading -->
    <div class="tag-loading" *ngIf="!viewDetails().has(view.id)">Cargando...</div>

    <!-- Columns (raw tags) -->
    <ng-container *ngIf="viewDetails().has(view.id)">
      <div class="tag-header-label" *ngIf="viewDetails().get(view.id)!.columns.length">Columnas</div>
      <button
        *ngFor="let col of viewDetails().get(view.id)!.columns"
        class="tag-leaf column-leaf"
        (click)="selectViewColumn(view, col)"
      >
        <ng-icon name="heroSignal" size="14" />
        <span>{{ col.alias }}</span>
        <span class="tag-agg">{{ col.aggregation }}</span>
      </button>

      <!-- Formulas -->
      <div class="tag-header-label" *ngIf="viewDetails().get(view.id)!.formulas.length">Formulas</div>
      <button
        *ngFor="let formula of viewDetails().get(view.id)!.formulas"
        class="tag-leaf formula-leaf"
        (click)="selectFormula(view, formula)"
      >
        <ng-icon name="heroCalculator" size="14" />
        <span>{{ formula.alias }}</span>
        <span class="formula-expr">{{ formula.expression | slice:0:20 }}</span>
      </button>
    </ng-container>
  </div>
</div>
```

### Step 5: Add CSS styles

```css
/* Separator */
.tag-separator {
  padding: 8px 12px 4px;
  border-top: 1px solid var(--border-default);
  margin-top: 4px;
}

.separator-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

/* View nodes */
.view-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  transition: background 0.1s ease;
}

.view-header:hover {
  background: var(--bg-card-hover);
}

.view-icon {
  color: var(--accent);
}

.view-badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--text-on-accent);
}

.view-children {
  padding-left: 16px;
}

.tag-header-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  padding: 6px 12px 2px;
}

.formula-leaf {
  border-left: 2px solid var(--accent);
}

.formula-expr {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-muted);
  font-family: monospace;
}

.tag-agg {
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
}
```

### Step 6: Import new icons

Add `heroVariable`, `heroCalculator`, `heroChevronDown`, `heroChevronRight` to the component's `provideIcons()` if not already imported.

### Step 7: Verify build + visual check

Run: `cd "Proyecto SCADA/scada-front/scada-front" && npx ng build --configuration development 2>&1 | tail -5`

### Step 8: Commit

```bash
git add -A
git commit -m "feat(sinopticos): add Mis Vistas section to tag browser with formula selection"
```

---

## Task 4: Handle Formula Selections in Sinoptico Editor

**Files:**
- Modify: `scada-front/src/app/pages/sinopticos/sinoptico-editor/sinoptico-editor.ts`

### Step 1: Update onLabelTagSelect to handle view source

```typescript
onLabelTagSelect(widgetId: string, tag: TagSelection): void {
  if (tag.source === 'view') {
    this.store.updateWidgetConfig(widgetId, {
      source: 'view',
      viewId: tag.viewId,
      formulaId: tag.formulaId,
      formulaAlias: tag.formulaAlias,
      title: tag.formulaAlias || 'Formula',
      devEUI: '',
      measurement: '',
    });
  } else {
    this.store.updateWidgetConfig(widgetId, {
      source: 'tag',
      viewId: undefined,
      formulaId: undefined,
      formulaAlias: undefined,
      devEUI: tag.devEUI,
      measurement: tag.measurement,
      title: `${tag.siteName} - ${tag.measurement}`,
    });
  }
  this.refreshData();
}
```

### Step 2: Update addChartSeries to handle view source

```typescript
addChartSeries(widgetId: string, tag: TagSelection): void {
  const widget = this.store.widgets().find((w) => w.id === widgetId);
  if (!widget) return;
  const config = widget.config as ChartConfig;
  const color = SERIES_COLORS[config.series.length % SERIES_COLORS.length];

  const newSeries: any = {
    label: tag.source === 'view' ? (tag.formulaAlias || 'Formula') : `${tag.siteName} - ${tag.measurement}`,
    color,
    lineType: 'line' as const,
    yAxisIndex: 0,
    devEUI: tag.devEUI,
    measurement: tag.measurement,
    source: tag.source || 'tag',
    viewId: tag.viewId,
    formulaId: tag.formulaId,
    formulaAlias: tag.formulaAlias,
  };

  this.store.updateWidgetConfig(widgetId, {
    series: [...config.series, newSeries],
  });
  this.refreshData();
}
```

### Step 3: Update addTableColumn similarly

```typescript
addTableColumn(widgetId: string, tag: TagSelection): void {
  const widget = this.store.widgets().find((w) => w.id === widgetId);
  if (!widget) return;
  const config = widget.config as TableConfig;

  const newCol: any = {
    label: tag.source === 'view' ? (tag.formulaAlias || 'Formula') : `${tag.siteName} - ${tag.measurement}`,
    unit: '',
    devEUI: tag.devEUI,
    measurement: tag.measurement,
    source: tag.source || 'tag',
    viewId: tag.viewId,
    formulaId: tag.formulaId,
    formulaAlias: tag.formulaAlias,
  };

  this.store.updateWidgetConfig(widgetId, {
    columns: [...config.columns, newCol],
  });
  this.refreshData();
}
```

### Step 4: Update getLiveValue to handle view keys

```typescript
getLiveValue(config: any): number | null {
  if (config.source === 'view' && config.viewId && config.formulaId) {
    return this.dataStore.getValue(`view:${config.viewId}:formula:${config.formulaId}`, '');
  }
  return this.dataStore.getValue(config.devEUI, config.measurement);
}
```

### Step 5: Verify build

Run: `cd "Proyecto SCADA/scada-front/scada-front" && npx ng build --configuration development 2>&1 | tail -5`

### Step 6: Commit

```bash
git add -A
git commit -m "feat(sinopticos): handle view formula selections in editor for all widget types"
```

---

## Task 5: Extend Backend POST /sinopticos/:id/query for Formula Resolution

**Files:**
- Modify: `scada-query-api/src/routes/sinoptico-routes.ts` (POST /:id/query handler)

### Step 1: Import formula engine

At top of file:
```typescript
import { evaluateFormulasBatch } from '../services/formula-engine';
```

### Step 2: Extend the query handler

After collecting raw devEUI pairs, add formula resolution logic:

```typescript
// Inside POST /sinopticos/:id/query handler, after existing raw-tag query logic:

// Collect view-sourced widgets
const viewWidgets = widgets.filter((w: any) => {
  const cfg = w.config;
  if (cfg.source === 'view') return true;
  if (cfg.series) return cfg.series.some((s: any) => s.source === 'view');
  if (cfg.columns) return cfg.columns.some((c: any) => c.source === 'view');
  return false;
});

// Collect unique viewIds
const viewIds = new Set<number>();
for (const w of viewWidgets) {
  const cfg = w.config;
  if (cfg.viewId) viewIds.add(cfg.viewId);
  if (cfg.series) cfg.series.filter((s: any) => s.viewId).forEach((s: any) => viewIds.add(s.viewId));
  if (cfg.columns) cfg.columns.filter((c: any) => c.viewId).forEach((c: any) => viewIds.add(c.viewId));
}

// For each viewId, load columns + formulas, fetch raw data, evaluate
for (const viewId of viewIds) {
  const viewResult = await pool.query(
    `SELECT vv.*, vc.id as col_id, vc.alias as col_alias, vc.dev_eui, vc.measurement as col_measurement, vc.aggregation
     FROM scada.variable_views vv
     LEFT JOIN scada.view_columns vc ON vc.view_id = vv.id
     WHERE vv.id = $1
     ORDER BY vc.sort_order`,
    [viewId]
  );

  const formulaResult = await pool.query(
    `SELECT * FROM scada.view_formulas WHERE view_id = $1 ORDER BY sort_order`,
    [viewId]
  );

  // Build column bindings from site_status (reuse existing measurement->field mapping)
  const bindings: Record<string, number | null> = {};
  let colIdx = 1;
  for (const col of viewResult.rows) {
    if (!col.col_id) continue;
    const devEUI = col.dev_eui;
    const field = measurementToField(col.col_measurement);
    const siteRow = await pool.query(
      `SELECT ${field} FROM scada.site_status WHERE dev_eui = $1`,
      [devEUI]
    );
    const val = siteRow.rows[0]?.[field] ?? null;
    bindings[col.col_alias] = val !== null ? Number(val) : null;
    bindings[`i_${colIdx}`] = bindings[col.col_alias];
    colIdx++;
  }

  // Evaluate formulas
  const evaluated = evaluateFormulasBatch(
    formulaResult.rows.map((f: any) => ({
      alias: f.alias,
      expression: f.expression,
      depends_on: f.depends_on || [],
    })),
    bindings
  );

  // Add formula results to response
  for (const f of formulaResult.rows) {
    results[`view:${viewId}:formula:${f.id}`] = {
      value: evaluated[f.alias] ?? null,
    };
  }
}
```

### Step 3: Add measurementToField helper

```typescript
function measurementToField(measurement: string): string {
  const map: Record<string, string> = {
    caudal_lts: 'last_flow_value',
    presion_kg: 'last_pressure_value',
    nivel_m: 'last_nivel_value',
    lluvia_mm: 'last_lluvia_value',
    rssi: 'rssi',
    snr: 'snr',
    battery: 'battery_level',
    value_presion: 'last_pressure_value',
    value_caudal: 'last_flow_value',
    value_caudal_totalizado: 'last_totalized_value',
    value_senal: 'rssi',
    value_nivel: 'last_nivel_value',
    value_lluvia: 'last_lluvia_value',
  };
  return map[measurement] || measurement;
}
```

### Step 4: Test manually with curl

```bash
curl -X POST http://localhost:3001/api/v1/sinopticos/1/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"widgets":[{"config":{"source":"view","viewId":1,"formulaId":1}}]}'
```

### Step 5: Commit

```bash
git add -A
git commit -m "feat(sinopticos): resolve variable view formulas in batch query endpoint"
```

---

## Task 6: Add POST /variables/views/:id/execute-series Endpoint

**Files:**
- Modify: `scada-query-api/src/routes/variable-routes.ts`

### Step 1: Add the endpoint after existing execute endpoint

This endpoint returns historical time-series data for a formula by:
1. Loading the view's columns (each is a devEUI+measurement)
2. Querying InfluxDB for historical data of each column over the requested time range
3. Aligning timestamps across all columns
4. Evaluating the formula at each timestamp

```typescript
router.post('/views/:id/execute-series', isAuth, async (req: Request, res: Response) => {
  const viewId = parseInt(req.params.id);
  const { formulaId, range = '24h' } = req.body;

  // Load view columns
  const colResult = await pool.query(
    'SELECT * FROM scada.view_columns WHERE view_id = $1 ORDER BY sort_order',
    [viewId]
  );
  const columns = colResult.rows;

  // Load the specific formula
  const fResult = await pool.query(
    'SELECT * FROM scada.view_formulas WHERE id = $1 AND view_id = $2',
    [formulaId, viewId]
  );
  if (!fResult.rows.length) {
    return res.status(404).json({ error: 'Formula not found' });
  }
  const formula = fResult.rows[0];

  // Load dependent formulas if any
  const allFormulas = await pool.query(
    'SELECT * FROM scada.view_formulas WHERE view_id = $1 ORDER BY sort_order',
    [viewId]
  );

  // Query InfluxDB for each column's historical data
  const influxRange = toInfluxRange(range);
  const columnSeries: Record<string, Map<number, number>> = {};

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const bucket = col.dev_eui.startsWith('dev') ? process.env.INFLUX_BUCKET_IGNITION : process.env.INFLUX_BUCKET;
    const field = measurementToInfluxField(col.measurement);

    const query = `
      from(bucket: "${bucket}")
        |> range(start: ${influxRange})
        |> filter(fn: (r) => r["dev_eui"] == "${col.dev_eui}" and r["_field"] == "${field}")
        |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
        |> yield(name: "mean")
    `;

    const data = await queryInflux(query);
    const tsMap = new Map<number, number>();
    for (const point of data) {
      tsMap.set(point.timestamp, point.value);
    }
    columnSeries[col.alias] = tsMap;
    columnSeries[`i_${i + 1}`] = tsMap;
  }

  // Collect all unique timestamps
  const allTimestamps = new Set<number>();
  for (const tsMap of Object.values(columnSeries)) {
    for (const ts of tsMap.keys()) {
      allTimestamps.add(ts);
    }
  }
  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

  // Evaluate formula at each timestamp
  const seriesData: [number, number][] = [];
  for (const ts of sortedTimestamps) {
    const bindings: Record<string, number | null> = {};
    for (const [alias, tsMap] of Object.entries(columnSeries)) {
      bindings[alias] = tsMap.get(ts) ?? null;
    }

    // Evaluate all formulas (handles dependencies)
    const evaluated = evaluateFormulasBatch(
      allFormulas.rows.map((f: any) => ({
        alias: f.alias,
        expression: f.expression,
        depends_on: f.depends_on || [],
      })),
      bindings
    );

    const val = evaluated[formula.alias];
    if (val !== null && val !== undefined && !isNaN(val)) {
      seriesData.push([ts, val]);
    }
  }

  res.json({
    formulaId: formula.id,
    alias: formula.alias,
    data: seriesData,
  });
});
```

### Step 2: Add helper functions

```typescript
function toInfluxRange(range: string): string {
  const map: Record<string, string> = {
    '1h': '-1h', '6h': '-6h', '24h': '-24h', '7d': '-7d', '30d': '-30d',
  };
  return map[range] || '-24h';
}

function measurementToInfluxField(measurement: string): string {
  // Map view column measurements to InfluxDB field names
  const map: Record<string, string> = {
    caudal_lts: 'flow_value',
    presion_kg: 'pressure_value',
    nivel_m: 'nivel_value',
    lluvia_mm: 'lluvia_value',
    value_presion: 'presion',
    value_caudal: 'caudal',
    value_caudal_totalizado: 'caudal_totalizado',
    value_senal: 'senal',
    value_nivel: 'nivel',
    value_lluvia: 'lluvia',
  };
  return map[measurement] || measurement;
}
```

### Step 3: Verify endpoint with curl

```bash
curl -X POST http://localhost:3001/api/v1/variables/views/1/execute-series \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"formulaId": 1, "range": "24h"}'
```

### Step 4: Commit

```bash
git add -A
git commit -m "feat(variables): add execute-series endpoint for historical formula time-series"
```

---

## Task 7: Extend SinopticoDataStore for View Sources

**Files:**
- Modify: `scada-front/src/app/pages/sinopticos/sinoptico-editor/store/sinoptico-data-store.ts`

### Step 1: Update fetchLiveValues to handle view-sourced results

The backend now returns formula values with keys like `view:1:formula:2`. The data store already stores `_liveValues` as a flat Record. The new keys will naturally flow through.

Modify `getValue()`:

```typescript
getValue(keyOrDevEUI: string, measurement?: string): number | null {
  const values = this._liveValues();
  // View formula key: "view:1:formula:2"
  if (keyOrDevEUI.startsWith('view:')) {
    const entry = values[keyOrDevEUI];
    return entry?.value ?? null;
  }
  // Original tag key: "devEUI::measurement"
  const key = `${keyOrDevEUI}::${measurement}`;
  const row = values[key];
  if (!row) return null;
  const field = this.measurementToField(measurement!);
  const val = row[field];
  return val !== null && val !== undefined ? Number(val) : null;
}
```

### Step 2: Update fetchAllChartData to handle view formula series

```typescript
private async fetchAllChartData(): Promise<void> {
  const widgets = this._widgets;
  const newData: Record<string, [number, number][]> = { ...this._chartData() };

  for (const w of widgets) {
    if (w.type !== 'chart') continue;
    const config = w.config as ChartConfig;

    for (const series of config.series) {
      if (series.source === 'view' && series.viewId && series.formulaId) {
        // Fetch formula historical series
        const key = `view:${series.viewId}:formula:${series.formulaId}`;
        try {
          const result = await firstValueFrom(
            this.variableService.executeViewSeries(series.viewId, series.formulaId, config.timeRange || '24h')
          );
          newData[key] = result.data;
        } catch {
          newData[key] = [];
        }
      } else {
        // Existing raw-tag chart data fetch
        const key = `${series.devEUI}:${series.measurement}`;
        // ... existing logic
      }
    }
  }

  this._chartData.set(newData);
}
```

### Step 3: Inject VariableService

```typescript
private variableService = inject(VariableService);
```

### Step 4: Update getChartSeries to handle view keys

```typescript
getChartSeries(series: any): [number, number][] {
  if (series.source === 'view' && series.viewId && series.formulaId) {
    return this._chartData()[`view:${series.viewId}:formula:${series.formulaId}`] || [];
  }
  return this._chartData()[`${series.devEUI}:${series.measurement}`] || [];
}
```

### Step 5: Verify build

Run: `cd "Proyecto SCADA/scada-front/scada-front" && npx ng build --configuration development 2>&1 | tail -5`

### Step 6: Commit

```bash
git add -A
git commit -m "feat(sinopticos): extend data store to resolve view formula values and chart series"
```

---

## Task 8: Update Table Widget for Formula Values

**Files:**
- Modify: `scada-front/src/app/pages/sinopticos/shared/widget-renderers/table-widget.ts`

### Step 1: Update getCellValue to handle view source

```typescript
getCellValue(col: any): string {
  if (col.source === 'view' && col.viewId && col.formulaId) {
    const key = `view:${col.viewId}:formula:${col.formulaId}`;
    const entry = this.liveValues()[key];
    const val = entry?.value ?? null;
    return val !== null ? Number(val).toFixed(2) : '--';
  }
  // Existing raw-tag logic
  const values = this.liveValues();
  const key = `${col.devEUI}::${col.measurement}`;
  const row = values[key];
  if (!row) return '--';
  const field = this.measurementToField(col.measurement);
  const val = row[field];
  return val !== null && val !== undefined ? Number(val).toFixed(2) : '--';
}
```

### Step 2: Update template to pass column object

If the template currently calls `getCellValue(col.devEUI, col.measurement)`, change it to `getCellValue(col)`.

### Step 3: Verify build

Run: `cd "Proyecto SCADA/scada-front/scada-front" && npx ng build --configuration development 2>&1 | tail -5`

### Step 4: Commit

```bash
git add -A
git commit -m "feat(sinopticos): update table widget to display formula values from variable views"
```

---

## Task 9: Update Config Panels to Show Source Badge

**Files:**
- Modify: label config panel HTML/CSS
- Modify: chart config panel HTML/CSS
- Modify: table config panel HTML/CSS

### Step 1: Add source indicator to label config panel

After the tag browser in the label config panel, add a visual indicator showing the current binding source:

```html
<div class="source-badge" *ngIf="widget.config.source === 'view'">
  <ng-icon name="heroVariable" size="14" />
  <span>{{ widget.config.formulaAlias || 'Formula' }}</span>
  <button class="badge-clear" (click)="clearSource()" title="Cambiar a tag directo">
    <ng-icon name="heroXMark" size="12" />
  </button>
</div>
```

### Step 2: Add badge CSS (shared across config panels)

```css
.source-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--accent);
  color: var(--text-on-accent);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 8px;
}

.badge-clear {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  display: flex;
  opacity: 0.7;
}

.badge-clear:hover {
  opacity: 1;
}
```

### Step 3: Add clearSource method in editor

```typescript
clearSource(widgetId: string): void {
  this.store.updateWidgetConfig(widgetId, {
    source: 'tag',
    viewId: undefined,
    formulaId: undefined,
    formulaAlias: undefined,
  });
}
```

### Step 4: Add similar badges to chart series and table columns

For chart config panel, show a small "f(x)" badge next to series items that come from formulas.
For table config panel, show the same badge next to formula columns.

### Step 5: Verify build

Run: `cd "Proyecto SCADA/scada-front/scada-front" && npx ng build --configuration development 2>&1 | tail -5`

### Step 6: Commit

```bash
git add -A
git commit -m "feat(sinopticos): add source badges to config panels for formula-bound widgets"
```

---

## Task 10: Update Chart Widget to Use View Series Keys

**Files:**
- Modify: `scada-front/src/app/pages/sinopticos/shared/widget-renderers/chart-widget.ts`

### Step 1: Update renderChart to handle view keys

In the `renderChart()` method where it builds series data from `chartData`, update the key lookup:

```typescript
// When building series for ECharts
const seriesKey = series.source === 'view' && series.viewId && series.formulaId
  ? `view:${series.viewId}:formula:${series.formulaId}`
  : `${series.devEUI}:${series.measurement}`;
const data = chartData[seriesKey] || [];
```

### Step 2: Verify build

Run: `cd "Proyecto SCADA/scada-front/scada-front" && npx ng build --configuration development 2>&1 | tail -5`

### Step 3: Commit

```bash
git add -A
git commit -m "feat(sinopticos): update chart widget to render formula series from variable views"
```

---

## Task 11: Update Label Widget Template for View Source

**Files:**
- Modify: `scada-front/src/app/pages/sinopticos/sinoptico-editor/sinoptico-editor.ts` (where label widget is rendered)
- Modify: `scada-front/src/app/pages/sinopticos/sinoptico-editor/sinoptico-editor.html`

### Step 1: Update getLiveValue calls in template

Where the editor passes `liveValue` to label-widget, update to handle view sources:

```html
<!-- Label widget binding -->
<app-label-widget
  [config]="widget.config"
  [liveValue]="getLiveValue(widget.config)"
/>
```

The `getLiveValue(config)` method from Task 4 already handles both sources.

### Step 2: Update chart data passing

Where chart-widget receives `chartData`, ensure the data store returns view keys:

```html
<!-- Chart widget binding -->
<app-chart-widget
  [config]="widget.config"
  [chartData]="dataStore.chartData()"
/>
```

No change needed here — the data store already populates both tag keys and view keys.

### Step 3: Update table values passing

```html
<!-- Table widget binding -->
<app-table-widget
  [config]="widget.config"
  [liveValues]="dataStore.liveValues()"
/>
```

No change needed — the data store already includes view keys.

### Step 4: Verify build

Run: `cd "Proyecto SCADA/scada-front/scada-front" && npx ng build --configuration development 2>&1 | tail -5`

### Step 5: Commit

```bash
git add -A
git commit -m "feat(sinopticos): wire view-source values through editor to all widget renderers"
```

---

## Task 12: Update CHANGELOG and Final Verification

**Files:**
- Modify: `Proyecto SCADA/CHANGELOG.md`

### Step 1: Add entries to CHANGELOG

Under `## [Unreleased]`, add:

```markdown
### scada-front (Sinopticos ↔ Variables Integration)
- feat: extend Tag Browser with "Mis Vistas" section showing user's variable views and formulas
- feat: extend TagSelection interface with source/viewId/formulaId for formula bindings
- feat: extend LabelConfig, ChartConfig, TableConfig with variable view source fields
- feat: handle formula selection in sinoptico editor for all widget types (label, chart, table)
- feat: extend SinopticoDataStore to resolve formula values and historical series
- feat: add source badges to config panels for formula-bound widgets
- feat: update chart widget to render formula time-series from variable views
- feat: update table widget to display formula computed values

### scada-query-api (Sinopticos ↔ Variables Integration)
- feat: extend POST /sinopticos/:id/query to resolve variable view formulas server-side
- feat: add POST /variables/views/:id/execute-series for historical formula time-series
- feat: add mine=true filter to GET /variables/views
```

### Step 2: Run full build

```bash
cd "Proyecto SCADA/scada-front/scada-front" && npx ng build --configuration development
cd "Proyecto SCADA/scada-query-api/scada-query-api" && npx tsc --noEmit
```

### Step 3: Run existing tests

```bash
cd "Proyecto SCADA/scada-query-api/scada-query-api" && npm test
```

### Step 4: Commit

```bash
git add -A
git commit -m "docs: update CHANGELOG with sinopticos-variables integration"
```

---

## Testing Plan

After implementation, manually test these flows:

1. **Tag Browser shows views:** Open sinoptico editor → click tag browser → scroll down → verify "Mis Vistas" section appears with user's views
2. **Expand view:** Click a view → verify columns and formulas load
3. **Bind formula to label:** Select a formula from a view → verify label widget shows formula name as title → verify value updates on refresh
4. **Bind formula to chart:** Add a formula series to chart → verify historical data renders
5. **Bind formula to table:** Add a formula column to table → verify computed value displays
6. **Mixed bindings:** Create a sinoptico with one raw-tag label and one formula label → verify both update correctly
7. **Save and reload:** Save sinoptico with formula bindings → reload page → verify bindings persist and values reload
8. **Source badge:** Verify formula-bound widgets show the maroon source badge with formula alias
