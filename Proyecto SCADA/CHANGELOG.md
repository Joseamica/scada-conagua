# Changelog

Todos los cambios notables del proyecto se documentan aquí.

## [Unreleased]

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
