# Changelog

Todos los cambios notables del proyecto se documentan aquí.

## [Unreleased]

### scada-query-api (Alarm form redesign — backend)
- **feat:** migration 037 — add `batch_id` UUID column to `scada.alarms` for multi-site alarm creation; create `scada.measurement_catalog` table with seeded 4PT/ICH measurements
- **fix:** migration 038 — deduplicate `measurement_catalog` rows and add `UNIQUE(key)` constraint (migration 037 was missing it, making `ON CONFLICT DO NOTHING` inoperative)
- **feat:** `GET /alarms/measurements` — returns measurement catalog grouped by provider for dropdown population
- **feat:** `GET /alarms/sites` — returns scoped site list (dev_eui, site_name, municipality, proveedor, site_type) with Municipal/Estatal/Federal scope filtering
- **feat:** `POST /alarms` — accepts `dev_euis: string[]` for batch creation (up to 200 devices per request, transactional with `BEGIN/COMMIT/ROLLBACK`, deduplication via `Set`, generates shared `batch_id`); backward-compatible with single `dev_eui`
- **fix:** `GET /alarms` — added scope filtering (Municipal/Estatal/Federal) so operators only see alarms for their sites; added `LEFT JOIN scada.inventory` to return `site_name` and `municipality` per alarm
- **feat:** `PUT /alarms/:id` — added audit log entry (`ALARM_UPDATED`) with changed fields

### scada-front (date-range-picker — popover clipping fix)
- **fix:** date-range-picker popover changed from `position: absolute` to `position: fixed` — prevents clipping by parent containers with `overflow: hidden` (was causing picker to appear cut off in gerencia-municipio and other pages)
- **fix:** popover position now calculated via `getBoundingClientRect()` on open; clamps right-edge to prevent left viewport overflow
- **fix:** `max-width: calc(100vw - 16px)` ensures picker is fully visible on any screen width

### scada-front (Alarm form redesign — dropdown UX + multi-site + severity banners)
- **feat:** new `AlarmFormDialogComponent` — standalone alarm form dialog with site search dropdown (grouped by municipality), measurement dropdown (filtered by site provider), severity-colored select, chip-based multi-site selector, notification placeholder section
- **fix:** `siteSearchText` converted from plain string to `signal('')` — fixes computed reactivity (Angular `computed()` only tracks signal reads, not plain property reads)
- **feat:** edit mode now allows changing the device/site — site selector is shown in both create and edit modes; `selectedSites` pre-populated from inventory async load with fallback for unknown devEUIs
- **feat:** `saveError` signal with error display in dialog when API save fails
- **feat:** `sitesLoading` signal with "Cargando sitios..." indicator while inventory loads
- **feat:** `@HostListener('document:click')` closes site dropdown on outside click
- **feat:** measurement options show provider suffix (4PT/ICH) when no site selected for disambiguation
- **refactor:** `AlarmConfig` — replaced inline `confirm()` with inline confirmation pattern (`confirmingDeleteId` signal → ¿Eliminar? + trash + X buttons); badge count decrements immediately on delete; alarm card shows `site_name` or falls back to raw `dev_eui`
- **feat:** `AlarmService` — added `AlarmSite`, `MeasurementOption`, `AlarmBatchResult` interfaces; added `getSitesForAlarm()`, `getMeasurements()`, `createAlarmBatch()` methods; added `site_name?: string` to `Alarm` interface
- **feat:** header-bar severity-colored alarm banners — critico (red), alerta (orange), aviso (blue) with matching per-severity pulse animations

### scada-front (GIS + Telemetria — sub-filtros operativos)
- **feat:** GIS layer panel — "Activos" split into 3 sub-layers: Operando (green, flow > 0), Sin gasto (amber, connected but no flow), Sin comunicacion (red, COMM LOSS >15min). Parent "Activos" checkbox toggles all 3.
- **feat:** GIS cluster groups now use distinct colors per operational state (green/amber/red)
- **feat:** GIS legend bar updated with new operational states (Operando, Sin gasto, Sin comunicacion)
- **feat:** Telemetria dashboard — status filter dropdown adds "Sin comunicacion" option + COMM LOSS detection (>15min stale)
- **feat:** Telemetria table — new `pill--danger` and `site-dot--danger` CSS for "Sin com." status display

### scada-query-api (municipio_id FK + scope filtering)
- **feat:** migration 035 — add `municipio_id` INT column to `scada.inventory`, backfill from municipality text via `scada.entities`, fix Chicoloapan INEGI code (28→29), create missing entities (Texcoco, Chimalhuacan, Nezahualcoyotl)
- **feat:** scope filter on `GET /sites` refactored from `LOWER(TRIM())` string match to integer `municipio_id` comparison (also adds Estatal scope)
- **feat:** scope check on `GET /status/:devEUI`, `GET /telemetry/:devEUI/:measurement`, `GET /sites/:devEUI`, `PUT /sites/:devEUI`, `DELETE /sites/:devEUI` — municipal users get 403 for out-of-scope sites
- **feat:** scope filter on `GET /alarms/active` — municipal/estatal users only see alarms for their sites
- **feat:** scope filter on `GET /variables/tags` refactored to integer `municipio_id` comparison
- **feat:** `POST /sites` and `PUT /sites/:devEUI` auto-resolve `municipio_id` from municipality text (or accept explicit value from frontend)
- **feat:** `GET /sites/:devEUI` now returns `municipio_id` in response

### scada-front (municipio_id on site create/edit)
- **feat:** `TelemetryService.createSite()` and `updateSite()` now accept optional `municipio_id` in payload
- **feat:** `SitioForm.save()` resolves INEGI `municipio_id` from `estados.json` and sends it with create/update requests

### scada-front (GIS — Marker color fix)
- **fix:** `.mk-op-stopped` CSS no longer applies `hue-rotate(148deg)` — stopped markers render blue like operating ones instead of orange
- **fix:** `.mk-ring-red` pulse changed from red (`rgba(239,68,68)`) to blue (`rgba(59,130,246)`) to match active marker color scheme

### scada-query-api (ID UTR field — bug fix)
- **feat:** Migration `036_add_utr_id_to_inventory.sql` — adds `utr_id VARCHAR(50)` column to `scada.inventory`
- **fix:** `GET /sites/:devEUI` now returns `utr_id` field
- **fix:** `PUT /sites/:devEUI` now accepts and persists `utr_id` field (was silently dropped)
- **fix:** `POST /sites` now accepts `utr_id` field on creation

### scada-front (ID UTR field — bug fix)
- **fix:** Site edit form (`sitio-form`) now loads `utr_id` from API into the "ID UTR" input field
- **fix:** Site edit/create form now sends `utr_id` in the update/create payload (reported by Anibal: field was always blank after save)

### scada-front (Alarm polling — BroadcastChannel leader election)
- **feat:** `AlarmService` now uses `BroadcastChannel` leader election — only 1 tab polls, others receive via broadcast. Reduces 40 tabs from 160 req/min to 4 req/min.

### scada-front (Quick peek — embed mode + fullscreen)
- **feat:** GIS and Telemetria pages support `?embed=1` query param to hide header/footer (for iframe embedding)
- **feat:** Quick peek modal fullscreen toggle button (expand/collapse with `heroArrowsPointingOut`/`heroArrowsPointingIn` icons)

### scada-front (GIS — Alarm overlay + Quick filter + COMM LOSS)
- **feat:** COMM LOSS detection — sites with `last_updated_at` >15 min stale are marked `no-signal` regardless of `estatus` field, with red glow animation on markers
- **feat:** Alarm badge overlay — bottom-center pill shows count of sites without communication (pulsing red dot)
- **feat:** Quick filter toolbar — collapsible panel with municipality dropdown, site type pills, flow range slider, and "Solo sin comunicacion" toggle
- **feat:** Filter by opacity (0.08) instead of hiding markers so cluster counts remain accurate
- **fix:** Filter panel z-index (1100) now renders above Leaflet zoom controls
- **fix:** Custom checkbox and range slider styling for consistent cross-browser appearance

### scada-front (Variable editor — Vista rapida)
- **feat:** "Vista rapida" button in variable-view-editor header opens a modal dialog with tabbed iframes (Mapa SIG / Telemetria) so users can reference the map without navigating away

### scada-front (Dev experience)
- **feat:** Dev favicon — localhost shows a dark-red "DEV" badge in the browser tab + title becomes "SOA [DEV]" to differentiate from production

### scada-query-api (RBAC-aware sinoptico sharing)
- **feat:** `GET /sinopticos/:id/share-candidates` now filters by caller's scope (Municipal/Estatal/Federal) and role hierarchy — municipal users only see same-municipality users at same or lower role
- **feat:** `GET /sinopticos/:id/shares` now returns `role_id`, `role_name`, and `municipio_name` for each shared user
- **feat:** `POST /sinopticos/:id/shares` validates scope + role before inserting — rejects sharing with higher-role users or out-of-scope users (403)

### scada-front (RBAC-aware sinoptico sharing UI)
- **feat:** Share candidates show role badge (color-coded by role) and municipality name
- **feat:** Current shares list shows role badge and municipality for each shared user
- **feat:** `SinopticoShare` interface and `searchShareCandidates` return type extended with role/scope fields

### scada-query-api (Multi-series chart endpoint)
- **feat:** `POST /views/:id/execute-series` now supports `all: true` mode — returns all column (raw variable) and formula time series in a single request, avoiding redundant InfluxDB queries
- **feat:** Backward-compatible: existing single-formula calls (`formulaId`) still work unchanged

### scada-front (Variable editor — multi-series chart with checkboxes)
- **feat:** Series chart now shows all columns (incognitas) and formulas with toggleable checkbox legend panel
- **feat:** Checkbox panel next to chart: color-coded dots, alias labels, point counts — click to toggle series visibility
- **feat:** "Grafico" button in header opens the multi-series chart view directly
- **feat:** Columns shown as solid lines, formulas as dashed lines, with 10-color palette
- **feat:** `executeViewAllSeries()` service method for the new `all: true` API mode

### scada-query-api (Formula null handling — professional SCADA behavior)
- **feat:** Migration `033_view_null_policy.sql` — adds `null_policy` column to `variable_views` (default: `'zero'`)
- **feat:** Formula engine now supports `nullPolicy` parameter: `'zero'` substitutes null with 0 (Ignition/AVEVA behavior), `'null'` propagates null (strict mode)
- **feat:** Formula engine returns quality metadata: `nullInputs` array tracks which bindings were null per formula
- **feat:** `COALESCE(val, fallback)` function added to formula engine for explicit null substitution
- **feat:** `POST /views/:id/execute` returns `quality` object with partial quality flags per formula
- **feat:** `POST /views/:id/execute-series` returns `partialTimestamps` array + stops filtering out partial results
- **feat:** `PUT /views/:id` accepts `null_policy` field to toggle between zero/null modes

### scada-front (Render display fix)
- **fix:** Pozo detail page now displays uploaded render images from the API (`render_url`). Previously only sites with hardcoded entries in `POZOS_LAYOUT` showed renders — uploaded renders via "Editar sitio" were ignored.

### scada-front (Formula null handling — quality indicators)
- **feat:** Variable view editor — null policy toggle select in header ("Nulos = 0" / "Nulos = estricto")
- **feat:** Results table shows amber "parcial" badge on formula values computed with incomplete inputs
- **feat:** COALESCE function button added to formula editor function bar + formula templates
- **feat:** `LabelWidget` and `VariableWidget` accept `partialQuality` input — show amber asterisk on partial values

### scada-query-api (Variables — authorization + validation audit)
- **fix:** Added `assertViewAccess()` ownership/share check to all view endpoints — `GET /views/:id`, column/formula CRUD, execute, execute-series, shares. Prevents unauthorized access by guessing sequential IDs (#1)
- **fix:** Validate `folder_id` ownership in `POST /views` and `PUT /views/:id` — users can no longer move views into another user's folder (#2)
- **fix:** Shares management (GET/POST/DELETE) now restricted to view owner (or admin) (#1)
- **fix:** Trim `dev_eui` and `measurement` inputs in `POST /views/:id/columns` — whitespace-only strings no longer pass validation (#11)
- **feat:** Validate `aggregation` enum in column creation/update — rejects invalid values before they reach InfluxDB (#12)
- **feat:** Return 409 on duplicate column (same `dev_eui + measurement` in view) for defense in depth (#5)
- **feat:** Migration `032_view_columns_unique_constraint.sql` — UNIQUE constraint on `(view_id, dev_eui, measurement)` (#5)

### scada-front (Variables — UX bugs)
- **fix:** Duplicate column prevention in editor — `onColumnTagSelected()` now checks existing columns before adding (#5)
- **fix:** Double-click prevention on "Agregar Formula" button — `addingFormula`/`addingColumn` loading signals disable buttons during API calls (#6)
- **fix:** Wizard now tracks failed columns and shows alert with count/names on completion (#8)
- **fix:** Wizard formula failure now shows error message instead of silently succeeding (#8)
- **fix:** Explorer `createFolder()` and `createView()` now show error alerts on API failure (#9)

### scada-query-api (RBAC — Bitacora municipal scope enforcement)
- **fix:** `GET /audit/logs` and `GET /audit/logs/export` now enforce municipal data isolation — Municipal users only see logs from users in their municipality, Estatal users see their state, Federal/Admin see all
- **fix:** Count query for pagination now joins `users` table to support scope filtering

### scada-igestion-api (Fixes críticos — cross-contamination + timestamps)
- **fix:** Removed dangerous ILIKE last-resort fallback in `updateIgnitionSiteStatus` — was causing ICH data (e.g., "POZO 01") to overwrite unrelated 4PT sites (e.g., "Pozo 011 - Chalco") via partial name matching
- **fix:** ChirpStack path now uses `new Date()` instead of `data.timestamp` for `last_updated_at` — prevents stale timestamps when device sends old epoch values
- **feat:** Added `case 'arrancador'` to Ignition variable switch — maps to `fallo_arrancador` column in site_status
- **fix:** Cleaned contaminated site_status for "Pozo 011 - Chalco" (4PT) which had ICH values from "POZO 01"

### scada-front (Sitio form — edicion de DevEUI + estatus pendiente)
- **feat:** DevEUI field is now editable in edit mode (was disabled as primary key) — allows field device replacement without DB access
- **feat:** When DevEUI is changed, cascades update to both `inventory` and `site_status` tables
- **feat:** Added 'Pendiente' option to site status dropdown

### scada-query-api (PUT /sites — DevEUI update support)
- **feat:** PUT `/api/v1/sites/:devEUI` now accepts optional `new_dev_eui` in body to change a site's DevEUI
- **feat:** Validates new DevEUI format, checks for uniqueness conflicts, cascades to `site_status`
- **feat:** Audit log records old and new DevEUI when changed

### scada-igestion-api (Modbus caudal + totalizado — ChirpStack)
- **feat:** `transformer-service.ts` now reads `modbus_chn_1` as direct Caudal (Lt/s) when present, bypassing 4-20mA scaling
- **feat:** `modbus_chn_2` mapped to `caudal_totalizado_m3` — direct engineering unit from Modbus meter
- **feat:** `influx-service.ts` writes `caudal_totalizado_m3` to InfluxDB when present
- **feat:** `postgres-service.ts` upserts `last_total_flow` in ChirpStack path (was Ignition-only)

### scada-query-api (InfluxDB query — ChirpStack totalizado mapping)
- **fix:** `influx-query-service.ts` maps `last_total_flow` → `caudal_totalizado_m3` for ChirpStack devices (was only mapped for Ignition)

### scada-query-api (Migration 029 — inventory population)
- **feat:** Migration `029_populate_inventory_from_excel.sql` — populated 206 new sites from Anibal's Excel, total 255 inventory rows
- **feat:** All new sites inserted as `pendiente` with placeholder dev_eui/gw_eui (auto-promote to activo on first telemetry)

### scada-front (Telemetria avanzada — Radar SCADA profesional)
- **refactor:** Modo radar migrado de valores crudos con unidades mixtas a **Índice Operativo SCADA (0–100)** con tres ejes: Caudal operativo, Presión operativa y Comunicación
- **feat:** Comparación multi-pozo sincronizada por timestamp operativo (usa el último instante común por pozo para evitar mezclar lecturas desfasadas)
- **fix:** Normalización robusta de comunicación: RSSI se interpreta en dBm (incluye corrección de signo cuando llega en magnitud positiva) y se combina con SNR en un score único
- **fix:** Eliminada distorsión por escalas dinámicas del radar (ejes fijos 0–100 con umbrales explícitos en UI)
- **fix:** En modo radar se deshabilita la edición de chips de variables para evitar ambigüedad visual; se añade banda informativa con criterios de normalización
- **fix:** Estadísticos inferiores ya no se muestran en radar; permanecen para modos de serie temporal

### scada-igestion-api (Motor de Evaluación de Alarmas)
- **feat:** New `alarm-evaluator.ts` — evaluates telemetry values against configured alarm thresholds on every ChirpStack uplink
- **feat:** State transitions: INACTIVE → ACTIVE_UNACK (condition met), ACTIVE_UNACK/ACK → INACTIVE (condition cleared)
- **feat:** Logs state transitions to console and writes to `alarm_state` + `alarm_history` tables
- **feat:** Fire-and-forget integration in `ingestion-client.ts` — alarm evaluation runs after site status update without blocking telemetry flow
- **feat:** Auto-promote now includes 'pendiente' estatus (pendiente → activo when valid telemetry arrives)

### scada-front (Header-bar con alarmas reales + banner + sonido)
- **feat:** Header-bar alert pill now shows live alarm count from `GET /alarms/active` (polls every 15s)
- **feat:** Alert dropdown populated with real active alarms — shows site name, alarm name, value, and threshold
- **feat:** Dynamic styling: danger pill only when alarms are active, severity-based colors in dropdown
- **feat:** Persistent alarm banner — full-width red pulsing bar at top of screen for alarms with `show_banner = true`
- **feat:** Audible alarm — two-tone beep plays on alarm activation and repeats every 30s for alarms with `play_sound = true`
- **feat:** Banner dismiss button — users can close the banner per alarm (reappears if new alarm triggers)
- **fix:** Removed hardcoded "4 Alertas" and fake alert items

### scada-front (Alarm config: sonido y banner configurable)
- **feat:** Two new toggles in alarm create/edit dialog: "Reproducir sonido al activarse" and "Mostrar banner en pantalla"

### scada-front (Pagina de Alarmas Activas)
- **feat:** New `/alarmas` page — real-time table of active alarms with severity, site, value, threshold, state, time
- **feat:** Severity filter chips (Todas, Critico, Alerta, Aviso) with live counts
- **feat:** ACK modal — acknowledge alarms with optional comment, updates state to ACTIVE_ACK
- **feat:** Quick navigation buttons: Actualizar, Historial, Configuracion
- **feat:** Empty state when no alarms are active
- **feat:** Footer nav "Alarmas" link now points to `/alarmas` (was broken `/dashboard/alarmas`)
- **fix:** Alarm sound pattern reduced to 2 beeps every 30s (was 6 tones every 8s)

### scada-query-api (Migration 028: alarm sound + banner columns)
- **feat:** Migration 028 adds `play_sound` and `show_banner` BOOLEAN columns to `scada.alarms` table
- **feat:** POST/PUT /alarms endpoints accept `play_sound` and `show_banner` fields
- **feat:** GET /alarms/active returns `play_sound` and `show_banner` for frontend consumption

### scada-front (GIS: fuzzy name matching para estatus correcto)
- **fix:** GIS map now correctly shows yellow (obra), gray (inactivo/pendiente) markers — was showing all blue/activo due to name mismatch between DB and KML
- **fix:** Race condition: `loadApiSitesCache()` now returns Promise, KML loading waits for API cache before resolving estatus
- **feat:** New `lookupApiSite()` with 3-level fuzzy matching: exact → deep-clean (strips dashes, quotes, parens, leading zeros, converts Roman numerals) → site-number fallback
- **feat:** Tested against all 49 KML/DB name pairs — 100% match rate on sites that exist in DB (handles "POZO 24" → "POZO 24 IXTAPALUCA", "Pozo 013 - Chimalpa 2" → "POZO 13 (CHIMALPA II)", etc.)

### scada-front (Estatus 'pendiente' en mapa GIS)
- **feat:** New `pozosPendienteLayer` in GIS map — gray icons with dashed border legend dot
- **feat:** `resolveSiteIconUrl()` renders pendiente sites with gray icons (same as inactivo)
- **feat:** Layer control includes "Sitios pendientes" toggle

### scada-query-api (Migration 027: estatus pendiente)
- **docs:** Migration 027 documents 'pendiente' as valid estatus value in inventory table

### scada-query-api (API: municipio_id en respuesta de sites)
- **feat:** `GET /api/v1/sites` now returns `municipio_id` (INEGI numeric code) via LEFT JOIN with `scada.entities` — enables frontend to filter/aggregate by municipality without hardcoded data
- **fix:** `GET /api/v1/sites` now filters by user's municipal scope — municipal users only see sites belonging to their municipality (same logic as `/variables/tags`)

### scada-front (Migración: POZOS_DATA eliminado — DB es fuente única de verdad)
- **refactor:** Removed `POZOS_DATA` (746 lines, 54 hardcoded sites) and `POZO_NAME_TO_ID` (49 entries) — all 6 consumer components now use API data from `/api/v1/sites`
- **refactor:** `overview.ts` — consolidated `initScopedData()` + `loadStaticData()` + `loadLiveFlowData()` into single `loadData()` method using API with `municipio_id`
- **refactor:** `gerencia-municipio.ts` — consolidated `loadMunicipioData()` + `loadLiveFlowData()` into single `loadData()` using API with `municipio_id`
- **refactor:** `modulo-gis.ts` — removed POZOS_DATA from `buildGastoByMunicipio()`, `resolveEstatus()`, `buildPozoPopup()`, and popup chart builder; all now use `apiSitesByName` cache
- **refactor:** `pozo-detalle.ts` — always resolves site via API (supports both devEUI and slugified name as route param); keeps POZOS_LAYOUT for overlay positions only
- **refactor:** `sitio-form.ts` — removed POZOS_DATA fallback for proveedor/render (API provides both)
- **refactor:** `telemetria-avanzada.ts` — removed redundant client-side scope filtering (API already scopes by municipality)

### scada-igestion-api (InfluxDB Ignition write fix)
- **fix:** `writeGroupedIgnitionToInflux()` — changed from creating a new `writeApi` per call (then `close()`) to using a persistent module-level `writeApiIgnition` with `flush()`. The previous pattern silently failed to persist Ignition/ICH telemetry to InfluxDB, leaving `telemetria_ignition` bucket empty. Historical charts for Ixtapaluca/ICH sites will now work after redeployment.

### scada-front (Anibal Obs #1 — Site type icons)
- **fix:** GIS `inferTypeFromName()` now recognizes "Cárcamo", "Drenaje", "Red primaria" — assigns drainage/block_water icons instead of defaulting to pozo icon
- **fix:** `inferTypeFromName()` now accepts optional `siteType` from DB, preferring it over name inference
- **fix:** `resolveSiteIconUrl()` applies status-based icons (activo/obra/inactivo) to ALL site types, not just wells — fixes layer toggle issues (Obs #4, #5)
- **feat:** Added `drainage` to `ScadaIconKey` type, `SCADA_ICON_MAP`, and `GRAY_ICON_MAP` — uses existing `drainage.svg` / `drainage-gray.svg` / `drainage-yellow.svg` assets

## [v0.11.0] - 2026-03-10

### scada-front (Sinoptico Sharing from Project Detail)
- **feat:** Share button on sinoptico cards in project detail view — opens share dialog directly from card actions
- **feat:** Share dialog: search users by name/email, select read/edit permission, add/remove shares with avatar list
- **feat:** "Compartidos conmigo" section on sinopticos home page — shows all sinopticos shared with the current user, with permission badge and quick view/edit buttons

### scada-query-api (Sinoptico Access Control)
- **fix:** `GET /projects/:id/sinopticos` — non-owner users now only see sinopticos they own or that are shared with them (admins and project owners see all)
- **fix:** `GET /sinopticos/:id` — access check: requires ownership, admin role, public project, or a share record. Returns 403 if unauthorized
- **fix:** `PUT /sinopticos/:id` — enforces owner or 'edit' share permission (admins bypass). Previously any user with `can_edit_sinopticos` permission could edit any sinoptico
- **feat:** `GET /sinopticos-shared` — new endpoint returning all sinopticos shared with the current user, including permission level and project name

### scada-front (Alarm Widget for Sinopticos)
- **feat:** Alarm Widget — displays live active alarms on the sinoptico canvas with 15-second polling
- **feat:** Severity color-coding: aviso (yellow), alerta (orange), critico (red) with pulsing indicator for unacknowledged critical alarms
- **feat:** Configurable: title, max visible items, font size, show/hide site name and timestamp, compact mode
- **feat:** Sorted display: critical alarms appear first, then alerta, then aviso
- **feat:** Available in both editor canvas and viewer

### scada-front (Activity Panel Fix)
- **fix:** Activity panel `translateAction` map now includes `saved`, `restored`, `unshared`, `deleted` actions — previously `saved` displayed as raw text instead of translated

### scada-front (Clock Widget)
- **feat:** Clock widget for sinoptico editor — displays current date/time with configurable 12h/24h format, optional date and seconds
- **feat:** Clock config panel — format selector, font size, text/background color, show date/seconds toggles
- **feat:** Clock widget available in both editor canvas and viewer

### scada-front (Variable Widget)
- **feat:** Variable Widget — displays live value from a Variable View column or formula on the sinoptico canvas
- **feat:** Config panel: select variable view, then pick a specific column or formula as data source
- **feat:** Presentation options: title, unit, decimals, font size, text/background color
- **feat:** Self-polling: widget fetches fresh values every 30s via `executeView` API
- **feat:** Available in both editor canvas and viewer

### scada-front (Sinoptico Trash / Recovery)
- **feat:** Trash button in project detail header — toggles collapsible papelera section
- **feat:** Trash section shows soft-deleted sinopticos with name, version, and deletion date
- **feat:** Restore button per trash item — recovers sinoptico and refreshes the list
- **fix:** Delete confirmation now says "Mover a la papelera" instead of "Eliminar"

### scada-front (Bug Fixes)
- **fix:** `getLiveValueForConfig` — guard against undefined `devEUI` for widget types without device binding (variable, clock, link). Prevents `TypeError: Cannot read properties of undefined (reading 'startsWith')` in `SinopticoDataStore.getValue()`
- **fix:** `getDeviceTimestamp` / `isDeviceStale` — same guard for non-device widgets
- **fix:** `onVariableViewChange` — ensure `columns` and `formulas` arrays exist even if API omits them
- **fix:** Template guard: `detail.formulas?.length` instead of `detail.formulas.length` to prevent crash on undefined

### scada-query-api (Sinoptico Soft-delete)
- **feat:** Soft-delete sinopticos — `DELETE` now sets `deleted_at` timestamp instead of hard delete
- **feat:** `GET /projects/:id/trash` — lists soft-deleted sinopticos for recovery
- **feat:** `POST /sinopticos/:id/restore` — restores a soft-deleted sinoptico, logs `SINOPTICO_RESTORED` audit event
- **feat:** Migration 025 — adds `deleted_at TIMESTAMPTZ` column + partial index to `scada.sinopticos`

### scada-front (Sinoptico Sharing UI)
- **feat:** Share button in editor toolbar opens sharing dialog modal
- **feat:** Search users by name/email with autocomplete dropdown, assign read or edit permissions
- **feat:** View current shares list with permission badges and remove access button
- **feat:** Follows same pattern as variable view sharing (identical UX)

### scada-query-api (Sinoptico Sharing)
- **feat:** `GET /sinopticos/:id/share-candidates?q=` — search users for sharing autocomplete
- **fix:** share-candidates SQL — changed `is_deleted = false` → `is_active = true` (column didn't exist)
- **fix:** variable share-candidates SQL — same `is_deleted` → `is_active` fix in variable-routes

### scada-front (Variable View Editor — Series Chart + Incognitas)
- **feat:** Series chart — per-formula chart button opens ECharts time-series line chart with area gradient
- **feat:** Series range selector — 1h/6h/24h/7d/30d buttons in chart panel header
- **feat:** Execution range dropdown — 1h/6h/24h/7d/30d selector before Execute button for aggregation window
- **feat:** Incognita persistence — renaming an incognita (`i_1` → custom name) now saves to backend and restores on reload

### scada-query-api (Variable Views — Aggregation + Incognitas)
- **feat:** Real InfluxDB aggregation — AVG/MIN/MAX/SUM/BAL now query InfluxDB with proper Flux functions (`mean`/`min`/`max`/`sum`/`spread`) instead of always using `site_status` LAST_VALUE
- **feat:** Execute-series endpoint respects aggregation type per column
- **feat:** `incognita_name` column — POST/PUT `/views/:id/columns` accept and persist custom variable names
- **feat:** Migration 024 — adds `incognita_name VARCHAR(100)` to `scada.view_columns`

## [v0.10.0] — 2026-03-10

### scada-front (GIS — Dynamic Estatus)
- **feat:** `resolveEstatus()` method — prefers API `site_status` data over hardcoded POZOS_DATA for icon color assignment; enables automatic blue/yellow/gray icons based on live DB state
- **fix:** `loadSitiosKml()` layer assignment now uses `resolveEstatus()` instead of reading directly from POZOS_DATA
- **fix:** Updated POZOS_DATA for ICH Ixtapaluca pozos (16, 21, 30, 35, 36, 42, 50) to 'Activo' — confirmed reporting telemetry

### scada-front (Audit Bitacora — Spanish Labels)
- **feat:** All `ACTION_META` entries now have Spanish labels (sinopticos, variables, alarms, GIS categories)
- **feat:** Badge colors for new categories: sinoptico (pink), variable (yellow), alarm (red), gis (green)

### scada-igestion-api (Auto-promote Estatus)
- **feat:** `promoteObraSiteIfNeeded()` — automatically promotes site from 'obra' to 'activo' in `scada.inventory` when valid telemetry arrives (one-way, never demotes)
- **feat:** Integrated into both ChirpStack (`updateSiteStatus`) and Ignition (`updateIgnitionSiteStatus`) paths

### scada-query-api (Tag Browser + Variable Execute Fixes)
- **fix:** Tag browser — normalized municipality casing with `UPPER(TRIM())`, filtered out Jiquilpan and ENSENADA test data, added `LENGTH >= 8` check for valid devEUIs
- **fix:** Variable execute — added Ignition measurement mappings (`value_presion`, `value_caudal`, etc.) so ICH site values no longer return null
- **fix:** Variable execute — corrected column name `last_totalized_value` → `last_total_flow` (matches actual `site_status` schema)

### scada-front (Sinopticos Editor — 11 Features)
- **feat:** Text Widget — static text block with configurable font size, weight, style, alignment, color, background, padding
- **feat:** Shape Widget — 10 shape types (rectangle, ellipse, line, triangle, diamond, arrow-right, arrow-down, pentagon, hexagon, star) with fill color, border color/width/radius; SVG-based rendering for polygons
- **fix:** Remove redundant per-shape opacity (use global widget opacity instead)
- **fix:** Config panel labels — sentence case instead of ALL CAPS, better field grouping with section headers
- **fix:** "Paleta" back button — now has arrow icon and is more discoverable
- **fix:** Shape config panel — grouped fields (Relleno/Borde sections), conditional fields (border radius only for rectangles), optgroup dropdown with categories
- **fix:** Text config panel — 2-column layout for typography fields, grouped into Tipografia/Apariencia sections
- **feat:** Auto-save — automatically saves every 30 seconds after the last change; shows "Guardado HH:mm" indicator in toolbar; manual save resets timer
- **feat:** Link Widget — inter-sinoptico navigation, select target from same project, clickable in viewer
- **feat:** Duplicate Widget — Ctrl+D shortcut + mini-toolbar button to clone selected widgets with +20px offset
- **feat:** Right-click Context Menu — duplicate, copy, z-order, lock/unlock, delete; canvas paste/select-all
- **feat:** Coordinates/Position Display — X, Y, W, H numeric inputs in config panel sidebar for precise positioning
- **feat:** Widget Opacity — global opacity slider (0-100%) on all widget types, applied via widget-wrapper
- **feat:** Match Size — match width, height, or both across 2+ selected widgets (align popover)
- **feat:** Canvas Config — size presets (1920x1080, 1280x720, 2560x1440), custom W/H, background color picker
- **feat:** Grid Config — dropdown with snap toggle, grid size input, size presets (5/10/20/50px)
- **feat:** Snap Guides — alignment lines appear when dragging widgets near edges/centers of other widgets

### scada-front (Sinopticos — Module Completion)
- **feat:** Widget alignment — 6 methods (left, center-H, right, top, center-V, bottom) with toolbar popover, inline SVG icons
- **feat:** Widget distribution — 2 methods (horizontal, vertical) for 3+ selected widgets
- **feat:** Widget grouping — `groupSelected()` / `ungroupSelected()` methods, Ctrl+G shortcut, group-aware drag (all grouped widgets move together), dashed border visual indicator
- **feat:** Group-aware selection — clicking any widget in a group selects all group siblings
- **feat:** Activity panel — slide-out right panel showing change history, integrated in both editor and viewer
- **feat:** Folder filtering in Variable Explorer — click folder to filter views, "Todas las vistas" option, active folder highlighting
- **feat:** Share dialog for Variable Views — search users, add/remove shares with read/edit permissions
- **feat:** Canvas export PNG — `html2canvas` dynamic import, downloads PNG at 2x scale
- **feat:** Export PNG and Activity buttons in editor toolbar-right

### scada-query-api (Variable View Sharing)
- **feat:** `GET /variables/views/:id/shares` — list shares for a view
- **feat:** `POST /variables/views/:id/shares` — add or update a share (upsert)
- **feat:** `DELETE /variables/views/:viewId/shares/:shareId` — remove a share
- **feat:** `GET /variables/views/:id/share-candidates?q=` — search users to share with

### scada-query-api (Audit Logging — Bitacora)
- **feat:** 16 new `AuditAction` types for sinopticos + variables operations
- **feat:** Sinoptico routes now log: project update, sinoptico create, save, duplicate, share, unshare (previously only project create/delete and sinoptico delete were logged)
- **feat:** Variable routes now log ALL write operations: folder create/delete, view create/update/delete, column add/update/delete, formula create/update/delete, view share/unshare (previously had zero audit logging)

### scada-front (COMM LOSS / Device Staleness)
- **feat:** `SinopticoDataStore` — new `deviceTimestamps` signal extracts `last_updated_at` per device from query response; `getDeviceTimestamp()` and `isStale()` methods (15-min threshold)
- **feat:** `LabelWidget` — new `lastUpdatedAt` and `isStale` inputs; shows "SIN COM." overlay with amber color when device is stale; relative timestamp ("hace X min") below the value
- **feat:** `TableWidget` — `isCellStale()` method highlights stale cells with amber italic styling
- **feat:** `SinopticoEditor` — `getDeviceTimestamp()` / `isDeviceStale()` helpers wired to label widget inputs
- **feat:** `SinopticoViewer` — same staleness helpers + `getLiveValueForConfig()` now handles view sources consistently with editor

### scada-front (Sinopticos ↔ Variables Integration)
- **feat:** `TagBrowser` "Mis Vistas" section — loads user's variable views below the tag tree, expandable to show columns (with aggregation badge) and formulas (with truncated expression), emits `TagSelection` with `source: 'view'` for formulas and `source: 'tag'` for view columns
- **feat:** `TagSelection` extended with `source`, `viewId`, `formulaId`, `formulaAlias` optional fields
- **feat:** `LabelConfig`, `ChartConfig`, `TableConfig` extended with variable view source fields
- **feat:** Editor handles formula selections — `onLabelTagSelect`, `addChartSeries`, `addTableColumn` all support view sources
- **feat:** `SinopticoDataStore` resolves formula live values (key `view:N:formula:M`) and historical series via `executeViewSeries`
- **feat:** Table widget renders formula computed values alongside raw-tag values
- **feat:** Chart widget renders formula time-series alongside raw-tag series
- **feat:** Source badge on label config panel — shows formula alias with clear button when bound to a view formula
- **feat:** `f(x)` badge on chart series and table columns when source is `'view'`
- **feat:** `clearViewSource()` method — resets widget back to raw-tag mode
- **feat:** `variable.service.ts` — added `getMyViews()`, `getViewDetail()`, `executeViewSeries()` methods

### scada-query-api (Sinopticos ↔ Variables Integration)
- **feat:** `POST /sinopticos/:id/query` — resolves variable view formulas server-side alongside raw-tag values
- **feat:** `POST /variables/views/:id/execute-series` — returns historical time-series for a formula (queries InfluxDB per column, evaluates formula at each timestamp)
- **feat:** `GET /variables/views?mine=true` — filter views by current user
- **feat:** Exported `queryApi` from `influx-query-service.ts` for reuse

### scada-front (Variables — Phase 4)
- **feat:** ICH-style formula editor in `VariableViewEditor` — split layout with incógnitas table (editable names + column origins, clickable to insert) and formula editor panel (OPERADORES bar + function buttons: IF, ABS, ROUND, MIN, MAX, SQRT, POW, ISNULL)
- **feat:** ICH-style formula editor in `TagBrowser` wizard Step 2 — same split layout for inline variable view creation
- **feat:** Incógnita name auto-generation from column aliases (e.g., `i_Pozo_001_Salesianos_caudal_lts`), with custom rename support and automatic translation to canonical `i_N` format before API calls
- **feat:** `VariableViewEditor` — two-panel editor for variable views: columns definition (tag browser, alias, aggregation select) + formulas definition (alias, expression, validate/add) + execution results table
- **feat:** Variable view execution — fetches latest values from site_status, evaluates formulas with `i_N` notation, displays computed results
- **feat:** `VariableExplorer` — view cards now clickable, navigate to `/variables/view/:id`
- **feat:** Route `/variables/view/:id` added (lazy-loaded)
- **fix:** `roleGuard` JWT fallback — decodes token from localStorage when `currentUser()` signal is null (fixes navigation to role-guarded routes)
- **fix:** `dashboard.css` padding-bottom typo (`690x` → `68px`)

### scada-query-api (Variables — Phase 4)
- **fix:** Formula execution `i_N` binding — maps column indices (`i_1`, `i_2`, ...) to column values before `evaluateFormulasBatch()`, strips index keys from output

### scada-front (Sinopticos — Phase 3 Data Binding)
- **feat:** `TagBrowser` component — tree picker for devEUI → measurement selection, grouped by municipality → site, with search/filter, dropdown UI, auto-loads from `GET /variables/tags`
- **feat:** `SinopticoDataStore` — signal-based data fetching service for sinoptico widgets: batch live values via `POST /sinopticos/:id/query` (polling every 60s), chart time-series via `GET /telemetry/:devEUI/:measurement`, measurement-to-field mapping for site_status
- **feat:** Label config panel — Tag Browser replaces manual devEUI/measurement inputs, alarm range editor (min/max/color/blink per range, add/remove)
- **feat:** Chart config panel — series editor with Tag Browser to add series, color picker, line type selector (line/bar/area), label editor, remove button per series
- **feat:** Table config panel — column editor with Tag Browser to add columns, label/unit inputs, remove button per column
- **feat:** Widget data wiring — `LabelWidget` accepts `liveValue` input and reacts via effect(), `ChartWidget` accepts `chartData` input, `TableWidget` accepts `liveValues` input with field mapping
- **feat:** Viewer live data — `SinopticoViewer` uses `SinopticoDataStore` for real-time polling, displays last update timestamp

### scada-front (Sinopticos — Phase 2 Canvas Editor)
- **feat:** `EditorStore` — signal-based state management with undo/redo (50-entry stack), selection, clipboard (copy/paste), dirty tracking, batch operations for drag performance
- **feat:** `WidgetWrapper` — absolute-positioned widget container with 8 resize handles, mini toolbar (delete/lock/bring-to-front), zoom-aware pointer movement/resize
- **feat:** 6 widget renderers: `LabelWidget` (numeric value + alarm color ranges), `ChartWidget` (ECharts time-series with theme support), `MapWidget` (Leaflet mini-map), `TableWidget` (data table with sticky headers), `HeaderWidget` (title bar with logo/colors), `ImageWidget` (static image with objectFit)
- **feat:** `sinoptico-editor` — full-screen canvas editor with HTML5 drag-drop from palette to canvas, click-to-add fallback, config panels per widget type in sidebar, zoom controls, grid toggle
- **feat:** Config panels for all widget types: label (title/unit/fontSize/decimals/devEUI/measurement), header (title/subtitle/bgColor/textColor/fontSize/logoUrl), image (src/alt/objectFit/borderRadius), chart (timeRange/showLegend/showGrid), table (showHeader/striped), map (lat/lng/zoom)
- **feat:** Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y redo, Ctrl+C copy, Ctrl+V paste, Ctrl+A select all, Delete remove, Ctrl+S save
- **feat:** Canvas state persistence — save to PostgreSQL JSONB, reload preserves all widgets with positions/sizes/configs, version bumps on save
- **fix:** `chart-widget` ThemeService API: `resolvedTheme()` → `resolved()`

### scada-query-api (Sinopticos + Variables + Alarmas — Phase 1 Foundation)
- **feat:** Migrations 013-023: sinoptico_projects, sinopticos, sinoptico_shares, variable_folders, variable_views, view_columns, view_formulas, view_shares, alarm_groups, alarms, alarm_state, alarm_history, alarm_recipients, alarm_recipient_collections, alarm_collection_members, alarm_group_recipients, sinoptico_activity_log, can_edit_sinopticos permission
- **feat:** `sinoptico-routes.ts` — CRUD projects, sinopticos (canvas JSONB), sharing, activity log, batch telemetry query, duplicate
- **feat:** `variable-routes.ts` — tag browser (devEUI→measurements scoped by municipality), variable views CRUD, columns, formulas with expr-eval validation, folder explorer, view execution with formula evaluation
- **feat:** `alarm-routes.ts` — alarm groups (hierarchical), alarm definitions with threshold/hysteresis/severity, alarm state + ACK with comment, alarm history with pagination + CSV export, recipients CRUD, recipient collections
- **feat:** `formula-engine.ts` — expr-eval wrapper with custom functions (IF, ISNULL, ABS, ROUND, MIN, MAX, SQRT, POW, LOG, LN), batch evaluation with topological sort, cycle detection
- **feat:** `canEditSinopticos` middleware — granular permission check (not a role) for sinoptico/variable editing
- **feat:** New audit actions: SINOPTICO_PROJECT_CREATED, SINOPTICO_PROJECT_DELETED, SINOPTICO_DELETED, ALARM_CREATED, ALARM_DELETED, ALARM_ACKNOWLEDGED

### scada-front (Sinopticos + Variables + Alarmas — Phase 1 Foundation)
- **feat:** `sinoptico.service.ts` — HTTP client for projects, sinopticos, canvas CRUD, sharing, activity, batch query
- **feat:** `variable.service.ts` — HTTP client for tags, folders, views, columns, formulas, validation, execution
- **feat:** `alarm.service.ts` — HTTP client for groups, alarms, active alarm polling (15s), ACK, history, recipients, collections; signal-based activeAlarms/activeCount/criticalCount
- **feat:** `sinopticos-home` — project listing with create/delete, card grid, create dialog
- **feat:** `project-detail` — sinoptico listing within project, create/delete/duplicate, thumbnail grid
- **feat:** `sinoptico-editor` — full-screen canvas editor shell with toolbar (save, zoom, grid toggle), sidebar (component palette placeholder), empty canvas with grid overlay
- **feat:** `sinoptico-viewer` — read-only sinoptico viewer shell
- **feat:** `variable-explorer` — folder tree sidebar + variable views list with create/delete
- **feat:** `alarm-config` — alarm group tree sidebar + alarm list with create/delete, severity badges, state indicators
- **feat:** `alarm-history` — paginated alarm history table with date/severity filters + CSV export
- **feat:** `recipients` — recipients CRUD + collections management with tabs
- **feat:** Routes added: /sinopticos, /sinopticos/proyecto/:id, /sinopticos/editor/:id (lazy), /sinopticos/viewer/:id (lazy), /variables (lazy), /alarmas/configuracion (lazy), /alarmas/historial (lazy), /alarmas/destinatarios (lazy)
- **feat:** Footer tab "Proyectos" renamed to "Sinopticos" pointing to /sinopticos
- **chore:** Dependencies: @angular/cdk, expr-eval, @types/expr-eval

### scada-igestion-api
- **feat:** Soporte para sensores de nivel (adc_3) y lluvia (adc_4) en pipeline de ingesta
- **feat:** Campos opcionales `nivel_m` y `lluvia_mm` en `TelemetryProcessed`
- **feat:** Transformer extrae adc_3/adc_4 con spread condicional (backwards-compatible)
- **feat:** InfluxDB writer escribe nivel_m/lluvia_mm solo cuando existen
- **feat:** PostgreSQL UPSERT con COALESCE para no sobreescribir nivel/lluvia con NULL
- **feat:** Switch cases Ignition para variables `nivel` y `lluvia`
- **fix:** Mapeo de `datos.nivel` en pozo-detalle apuntaba a batteryVal en vez de last_nivel_value
- **test:** 6 tests para transformer de nivel/lluvia (dead zone, scaling, metadata override)

### scada-query-api
- **feat:** Migracion `012_add_nivel_lluvia_columns.sql` — columnas `last_nivel_value` y `last_lluvia_value` en site_status
- **feat:** Campos nivel/lluvia en queries de `getSiteStatus` y `/api/v1/sites`
- **feat:** Mapping Ignition `nivel_m`/`lluvia_mm` en influx-query-service
- **feat:** Campos `last_nivel_value`/`last_lluvia_value` en interfaz `SiteStatus`
- **feat:** Endpoint `POST /api/v1/sites/:devEUI/render` para subir imágenes de render (multer, 10MB, PNG/JPG/WEBP)
- **feat:** Migración `011_add_render_url.sql` — columna `render_url` en inventario
- **feat:** `GET /api/v1/sites` y `GET /api/v1/sites/:devEUI` ahora incluyen `render_url`
- **feat:** Archivos estáticos servidos en `/api/v1/uploads/renders/`
- **feat:** `geoserver-service.ts` — cliente REST para GeoServer (publish, list, delete, health)
- **feat:** `gis-routes.ts` — endpoints CRUD para capas GIS (`/api/v1/gis/layers`, upload shapefile ZIP, multer 50MB)
- **feat:** Acciones de auditoría `GIS_LAYER_PUBLISHED` y `GIS_LAYER_DELETED`
- **feat:** `DELETE /api/v1/sites/:devEUI` — eliminar sitio del inventario y site_status con limpieza de render

### scada-front
- **feat:** Campos nivel/lluvia en modelos `SiteLiveStatus` y servicio de telemetria
- **feat:** Metricas de nivel y lluvia condicionales en popup GIS
- **feat:** Variables `nivel_m` y `lluvia_mm` en CHART_VARIABLES de pozo-detalle
- **fix:** `datos.nivel` ahora mapea `last_nivel_value` en vez de `battery_level`
- **fix:** Dedup GIS: sitios creados via formulario ya no generan marcador duplicado si un KML marker existe dentro de 100m (proximity check)
- **feat:** Selector de mapa base en GIS: Mapa (Carto light/dark), Satelite (Esri), Terreno (OpenTopoMap)
- **fix:** Badge "Sin senal" renombrado a "Sin gasto" en telemetria-dashboard (el sitio tiene senal pero sin flujo)
- **feat:** Subida de renders en `sitio-form` — archivo se sube al backend después de crear/editar sitio
- **feat:** `TelemetryService.uploadRender()` — método para subir imagen de render vía FormData
- **feat:** GIS popup ahora muestra render subido desde API, con fallback a assets estáticos
- **feat:** Manejo de sesión expirada — `authInterceptor` detecta 401/403 y redirige a `/login`
- **feat:** `authGuard` valida expiración del JWT (claim `exp`), no solo existencia del token
- **feat:** `guestGuard` impide acceso a `/login` y `/auth/login/token` si el usuario ya tiene sesión válida
- **feat:** Métodos `isTokenExpired()` y `clearSessionAndRedirect()` en `AuthService`
- **test:** 19 unit tests para auth.service, authInterceptor, authGuard y guestGuard
- **chore:** Configuración de Vitest (`vitest.config.ts` + `test-setup.ts` con Angular compiler)
- **fix:** Gráfica de pozo-detalle ahora muestra valores de 0 (presión/caudal) en vez de huecos — se eliminó filtro que convertía valores <= 0.01 a null
- **feat:** Integración WMS en módulo GIS — capas publicadas en GeoServer aparecen como overlays en Leaflet
- **feat:** Botón eliminar sitio en tabla de telemetría con confirmación
- **feat:** Click en row de tabla telemetría navega a pozo-detalle (stopPropagation en action buttons)
- **feat:** Tabla de telemetría se expande al alto de pantalla (`calc(100vh - 380px)`) — responsive
- **feat:** `TelemetryService.deleteSite()` — método para eliminar sitio vía API

### scada-igestion-api
- **fix:** `tsconfig.json` — agregado `include`/`exclude` para evitar error de `rootDir` con `vitest.config.ts`

---

## 2026-03-06

### scada-igestion-api
- **fix(security):** Escape de `siteName` en queries de InfluxDB para prevenir Flux injection (`54dfdac`)
- **fix:** Reconexión MQTT con opciones de keepalive, clientId único y event handlers (`54dfdac`)
- **fix:** Retry de escritura a InfluxDB (hasta 3x) en buffer de Ignition con snapshot para evitar data loss (`54dfdac`)
- **test:** 16 tests nuevos para buffer retry, Flux escape y rate limit (`54dfdac`)

### scada-query-api
- **fix(security):** Rate limiting de 3 por 15 min en `/resend-2fa` (`54dfdac`)
- **test:** Tests de seguridad para Flux escape y rate limit (`54dfdac`)
- **feat:** Migración `010_add_proveedor_estatus.sql` — columnas proveedor y estatus en inventario (`8c89f40`)

### scada-front
- **feat:** Campos proveedor y estatus en sitio-form (patch y save desde API) (`8c89f40`)
- **feat:** Cache de información adicional de sitios en módulo GIS (`8c89f40`)
- **feat:** Manejo dinámico de datos de sitio con fallback en PozoDetalle (`8c89f40`)
- **feat:** Mini sparkline chart en popups de pozos del módulo GIS (`4a15315`)
- **feat:** Serie dual caudal + presión en mini chart de popups GIS (`ce7dfd7`)
- **fix:** Redimensionar chart de popup GIS al cambiar tema; sitios dinámicos default activo (`be87709`)
- **fix:** Normalizar site_type y popular proveedor/render en sitio-form edit (`36fd4bc`)

## 2026-03-05

### scada-front
- **fix:** Modo vista (Comparativa/Completa) en overview-gastos (`7b9fed8`)
- **fix:** Radar chart no cargaba con un solo sitio; resize() antes de render (`7b9fed8`)
- **fix:** Sitios dinámicos mostraban amarillo/inactivo en vez de azul/activo en GIS (`7b9fed8`)
- **fix:** Layout de telemetría avanzada — viewport overflow con calc height; re-render en cambio de tema (`1db0ee9`)
- **fix:** Mock de permisos en tests de control; ajustes UI telemetría (`d645b6d`)
- **feat:** Edición de sitios — GET/PUT `/api/v1/sites/:devEUI` (`af3081d`)
- **feat:** Ícono amarillo para sitios creados dinámicamente en GIS (`af3081d`)
- **fix(security):** Protección contra CSV injection en export de auditoría (`af3081d`)
- **fix(security):** Flujo 2FA por email validado con tempToken JWT (previene brute-force sin autenticación previa) (`cd21d6f`)
- **fix(security):** Respuestas genéricas en resend-2fa para evitar enumeración de usuarios (`cd21d6f`)
- **fix:** Filtro de scope municipal corregido — DB tiene 'Municipal' no 'Municipio' (`11d957e`)
- **refactor:** Constantes de acciones de auditoría extraídas a `core/constants/audit-actions.ts` (`ac3c0c1`)

### scada-query-api
- **feat:** Endpoints GET/PUT `/api/v1/sites/:devEUI` para edición de sitios (`af3081d`)
- **fix(security):** tempToken JWT en verify-2fa y resend-2fa (`cd21d6f`)
- **fix:** Comparación de scope municipal — 'Municipal' vs 'Municipio' (`11d957e`)

## 2026-03-04

### scada-front
- **feat:** API endpoint POST para crear sitios en inventario (`b808432`)
- **feat:** Validación de campos requeridos en sitio-form con mensajes de error (`b808432`)
- **feat:** Colores dinámicos por municipio en overview según tema activo (`b808432`)
- **feat:** Popup charts con estados de loading/empty en GIS y SCADA (`ce3d772`)
- **feat:** Propiedad `can_operate` en UserSession/UserPermissions (`ce3d772`)
- **feat:** Card colapsable de totalizador en PozoDetalle (`ce3d772`)
- **feat:** Toolbar profesional con indicadores de variables, zoom y fullscreen en PozoDetalle (`554c70e`)
- **feat:** Date range picker para selección de tiempo personalizado (`3e497ff`)
- **feat:** Audit logging de logout integrado en HeaderBar (`3e497ff`)
- **style:** CSS variables en vez de colores hardcoded en múltiples componentes (`84d1849`)
- **feat:** Sistema de temas con CSS custom properties y toggle en header (`83e3b6a`)
- **feat:** `ThemeService` y `echarts-theme` utility (`83e3b6a`)
- **refactor:** Banner readonly para control de bombas con acceso restringido (`8679dd1`)
- **feat:** Control de bombas basado en rol (Admin/Supervisor) en PozoDetalle (`3dbb0a6`)
- **feat:** Auto-zoom basado en bounds de KML en GIS (`3dbb0a6`)
- **fix:** Dark mode en date inputs (`b808432`)

### scada-query-api
- **feat:** Endpoint POST para crear sitios en inventario (`b808432`)
- **feat:** Migración `009_add_can_operate_permission.sql` (`ce3d772`)
- **feat:** Servicio de permisos (`permission-service.ts`) (`ce3d772`)
- **feat:** Migración `008_create_audit_logs_table.sql` y servicio de auditoría (`3e497ff`)
- **feat:** Rutas de auditoría y entidades (`3e497ff`)

### scada-igestion-api
- **feat:** Mejoras en `ignition-transformer` e `influx-service` (`554c70e`)

## 2026-03-03

### ci/cd
- **ci:** Rewrite de deploy workflow para infraestructura OCI con rsync, rollback y health checks (`e98093e`)
- **fix:** Corregir output path de Angular en frontend deploy (`1c41543`)
- **fix:** Usar `EMAIL_USER`/`EMAIL_APP_PASS` en docker-compose.prod.yml (`db1288a`)
- **fix:** Ejecutar tests antes de build para evitar conflicto CJS/ESM; fix nombre de volumen prod (`6783019`)
- **ci:** Pipeline de deploy backend con rollback (`779e182`)
- **ci:** Workflows de CI y deploy iniciales (`0d7db54`)

### scada-front
- **feat:** Implementación de 2FA setup (TOTP) y verificación por email (`3c44cc1`)

### Proyecto
- **feat:** Commit inicial — Sistema SCADA SOA (`c5b55fc`)
