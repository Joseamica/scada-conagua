# Changelog

Todos los cambios notables del proyecto se documentan aquí.

## [Unreleased]

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

### scada-front
- **feat:** Campos nivel/lluvia en modelos `SiteLiveStatus` y servicio de telemetria
- **feat:** Metricas de nivel y lluvia condicionales en popup GIS
- **feat:** Variables `nivel_m` y `lluvia_mm` en CHART_VARIABLES de pozo-detalle
- **fix:** `datos.nivel` ahora mapea `last_nivel_value` en vez de `battery_level`
- **fix:** Dedup GIS: sitios creados via formulario ya no generan marcador duplicado si un KML marker existe dentro de 100m (proximity check)
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
