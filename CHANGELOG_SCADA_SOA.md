# Registro de Cambios — Sistema SCADA-SOA

**Fecha:** 25 de febrero de 2026
**Version:** 2.0 — Seguridad, Gobernanza RBAC y Mejoras de Interfaz
**Preparado para:** CONAGUA / OCAVM

---

## Resumen ejecutivo

Se realizaron **76 archivos modificados** con un total de **+6,313 lineas nuevas** y **-1,550 lineas eliminadas**. Los cambios abarcan desde nuevas funcionalidades de seguridad y gobernanza hasta rediseno completo de la interfaz de usuario con soporte responsive para pantallas de escritorio, tablets y celulares.

---

## 1. Pantalla de Inicio de Sesion (Login)

### Mejoras implementadas

- **Campo de correo electronico:** Ahora dice "Correo electronico" (antes decia "Usuario"). Tipo `email` para que el teclado del celular muestre el `@` automaticamente.
- **Limpieza automatica de espacios:** Si el usuario escribe espacios al inicio o final del correo, el sistema los elimina antes de enviar. Tambien convierte a minusculas (ej. `JUAN@conagua.gob.mx` se convierte a `juan@conagua.gob.mx`).
- **Boton de ojo para ver/ocultar contrasena:** Icono de "ojito" dentro del campo de contrasena. Al hacer click, muestra la contrasena en texto claro para verificar que se escribio correctamente. Al hacer click de nuevo, la oculta.
- **Boton "Entrar" deshabilitado mientras carga:** Evita doble click accidental. Muestra "Ingresando..." mientras se procesa.
- **Autocompletado del navegador:** Los campos ahora tienen `autocomplete="email"` y `autocomplete="current-password"`, lo que permite al navegador ofrecer guardar y rellenar credenciales.

### Archivos modificados
- `login.html` — Template del formulario
- `login.ts` — Logica de trim/lowercase y toggle de contrasena
- `login.css` — Estilos del ojito y boton deshabilitado

---

## 2. Pantalla de Verificacion 2FA (Token)

### Mejoras implementadas

- **Soporte para Google Authenticator (TOTP):** Ademas del codigo por correo, ahora el sistema detecta si el usuario tiene TOTP activado y muestra el formulario correspondiente.
- **Deteccion automatica del metodo:** Si el usuario usa correo electronico, ve "Ingresa el codigo de verificacion que enviamos a tu correo". Si usa Google Authenticator, ve "Ingresa el codigo de 6 digitos de Google Authenticator".
- **Reenvio de codigo:** Boton para reenviar el codigo por correo (solo si el metodo es email).

### Archivos modificados
- `token.html` — Template con soporte dual (email/TOTP)
- `token.ts` — Logica de deteccion de metodo y reenvio

---

## 3. Dashboard Principal (pantalla de inicio)

### Rediseno completo

- **Antes:** Tarjetas simples con texto e icono, fondo blanco plano.
- **Ahora:** Diseno tipo "Bento Grid" con:
  - **Seccion hero:** Fondo degradado vino/burdeos con logos de CONAGUA y SOA en blanco, titulo "Sistema Operativo del Agua" y subtitulo descriptivo.
  - **4 tarjetas de navegacion:** Cada una con icono a color, titulo, descripcion y flecha animada al pasar el mouse.
  - **Colores por modulo:** Vino para Telemetria, turquesa para GIS, ambar para Usuarios, gris para Proyectos.
  - **Tarjetas "wide":** Telemetria y Proyectos ocupan 2 columnas para darles mas protagonismo.

### Responsive
- **Escritorio (>1024px):** Grid de 2 columnas, tarjetas wide de 2 columnas.
- **Tablet (701-1024px):** Grid de 2 columnas con ancho reducido.
- **Celular (<700px):** Grid de 1 columna, todas las tarjetas apiladas.
- **Movimiento reducido:** Animaciones desactivadas si el usuario tiene `prefers-reduced-motion`.

### Archivos modificados
- `dashboard.html` — Estructura completa rediseñada
- `dashboard.css` — ~290 lineas nuevas de estilos

---

## 4. Barra de Navegacion Superior (Header)

### Mejoras implementadas

- **Rediseno visual:** Fondo degradado vino, layout mas limpio.
- **Informacion del usuario:** Muestra nombre y rol del usuario logueado.
- **Menu de usuario:** Click en avatar abre dropdown con opciones: Mi Perfil, Cerrar Sesion.
- **Responsive:** En pantallas pequenas se adapta reduciendo padding y ocultando elementos secundarios.

### Archivos modificados
- `header-bar.html` — Template rediseñado
- `header-bar.ts` — Logica de dropdown y sesion
- `header-bar.css` — ~630 lineas de estilos con breakpoints responsive

---

## 5. Barra de Navegacion Inferior (Footer Tabs)

### Mejoras implementadas

- **Rediseno visual:** Iconos mas claros, indicador de tab activo con barra superior animada.
- **Navegacion por roles:** Tabs visibles segun el rol del usuario:
  - Administrador: Dashboard, Telemetria, GIS, Usuarios, Gerencia
  - Supervisor/Operador/Tecnico: Solo las secciones que les corresponden
- **Responsive:** Iconos y labels se ajustan en pantallas pequenas.

### Archivos modificados
- `footer-tabs.html` — Template con tabs condicionales por rol
- `footer-tabs.ts` — Logica de visibilidad por rol
- `footer-tabs.css` — ~130 lineas con indicador animado

---

## 6. Panel de Telemetria

### Mejoras implementadas

- **Strip de KPIs:** 4 tarjetas en la parte superior: Total de pozos, Operando, Alerta, Sin comunicacion. Con iconos a color y contadores en tiempo real.
- **Tabla de pozos mejorada:** Columnas con badges de estado (Operando/Alerta/Sin Com.) con colores semaforo.
- **Panel lateral de detalle:** Al seleccionar un pozo, se despliega un panel con informacion en vivo: presion, caudal, bateria, señal.
- **Grafica de detalle mejorada:** Lineas mas finas estilo ECG, sin relleno de area. Valores <= 0.01 se tratan como nulos (bomba apagada). Separacion visual clara entre ejes de caudal, presion y señal.
- **Estadisticas filtradas:** Se excluyen lecturas con bomba apagada (caudal y presion ~0) para estadisticas mas precisas.

### Responsive
- **Escritorio:** Grid de 4 KPIs, tabla y panel lateral lado a lado.
- **Tablet:** Grid de 2 KPIs, panel lateral debajo de la tabla.
- **Celular:** KPIs apilados, tabla scrolleable, panel de detalle ocupa pantalla completa.

### Archivos modificados
- `telemetria-dashboard.html` — Template con KPIs y panel lateral
- `telemetria-dashboard.ts` — Logica de KPIs, seleccion de pozo
- `telemetria-dashboard.css` — ~500 lineas nuevas de estilos responsive

---

## 7. Detalle de Pozo (Graficas)

### Mejoras implementadas

- **Carga inmediata del status:** El status del pozo (presion, caudal) se carga inmediatamente al entrar, sin esperar al ciclo de 60 segundos.
- **Filtrado de lecturas con bomba apagada:** Valores <= 0.01 se tratan como null para que las graficas no muestren lineas pegadas al eje X cuando la bomba esta apagada.
- **Estilo de graficas mejorado:** Lineas mas finas (1.5px), sin relleno de area, sin step. Aspecto mas limpio tipo instrumentacion.
- **Estadisticas depuradas:** Promedios, maximos y minimos excluyen periodos con bomba apagada.

### Archivos modificados
- `pozo-detalle.ts` — Logica de carga inmediata y filtrado
- `pozo-detalle.css` — Correccion de formato en boton outline
- `pozos-data.ts` — Agregado pozo demo para desarrollo local
- `pozos-layout.ts` — Layout correspondiente al pozo demo

---

## 8. Modulo de Gestion de Usuarios

### Funcionalidades nuevas

#### 8.1 Arbol jerarquico de dependencias
- **Antes:** Labels genericos (Federal/Estatal/Municipal) sin funcionalidad.
- **Ahora:** Arbol con entidades reales de la base de datos:
  ```
  Todos
  FEDERAL
    CONAGUA
  ESTATAL
    OCAVM
      Ecatepec, Chalco, Chicoloapan
    CAEM
      Tlalnepantla, Valle de Chalco, La Paz
  ```
- **Click para filtrar:** Al hacer click en una entidad, la tabla de usuarios se filtra mostrando solo usuarios de esa dependencia y sus hijos.
- **Indicador visual:** Se muestra "Listado de usuarios . [Entidad seleccionada]" arriba de la tabla.
- **Boton "Todos":** Regresa a la vista completa.

#### 8.2 Tabla de usuarios mejorada
- Columnas: Nombre, Correo, Rol, Nivel, Dependencia, Estatus
- **Roles consistentes:** Administrador, Supervisor, Operador, Tecnico (antes habia nombres inconsistentes como "Ejecutivo" y "Consulta")
- **Dependencia visible:** Cada usuario muestra a que entidad organizacional pertenece

#### 8.3 Bitacora de auditoria (Seguridad Log)
- **Antes:** 3 registros hardcodeados (mock data).
- **Ahora:** Datos reales de la tabla `scada.audit_logs` via API.
- Muestra las ultimas 10 acciones: Usuario, Accion, IP, Fecha/Hora.
- Acciones registradas: LOGIN_SUCCESS, LOGIN_FAILED, CREATE_USER_SUCCESS, TOTP_ENABLED, NAVIGATE_TO_MODULE, etc.

#### 8.4 Reporte completo de auditoria
- Pagina dedicada `/reporte` con tabla paginada.
- Filtros por fecha (desde/hasta) y por usuario.
- **Paginacion real:** 50 registros por pagina con botones Anterior/Siguiente.
- **Exportar CSV:** Boton "Descargar CSV" genera archivo compatible con Excel.

#### 8.5 Formulario de usuario mejorado
- **Selector de dependencia:** Dropdown con las 9 entidades, mostrando nivel entre parentesis.
- **4 roles SOA:** Dropdown con Administrador, Supervisor, Operador, Tecnico.
- **Permisos granulares:** Checkboxes: Ver, Editar, Exportar, Bloquear. Conectados al backend.

### Responsive
- **Escritorio:** Layout de 3 columnas (arbol + tabla + auditoria).
- **Tablet:** Arbol colapsable, tabla y auditoria apilados.
- **Celular:** Todo apilado, arbol como acordeon.

### Archivos modificados
- `usuarios.html`, `usuarios.ts`, `usuarios.css` — Reescritura del modulo completo
- `usuario-detalle.html`, `usuario-detalle.ts` — Formulario con roles y dependencias
- `reporte-actividad.html`, `reporte-actividad.ts`, `reporte-actividad.css` — Reporte con datos reales

---

## 9. Perfil de Usuario

### Mejoras implementadas

- **Datos del perfil:** Nombre, correo, rol, nivel (datos del JWT).
- **Roles consistentes:** Usa la misma constante de roles que todo el sistema.
- **Google Authenticator:** Boton para activar/desactivar TOTP. Flujo completo: generar QR, escanear con Google Authenticator, verificar con codigo de 6 digitos.
- **Rediseno visual:** Card limpia con secciones bien definidas.

### Responsive
- **Escritorio:** Card centrada con ancho maximo.
- **Celular:** Card ocupa todo el ancho, campos apilados.

### Archivos modificados
- `perfil-usuario.html` — Template rediseñado con seccion TOTP
- `perfil-usuario.ts` — Logica de activacion/desactivacion TOTP
- `perfil-usuario.css` — ~625 lineas nuevas de estilos responsive

---

## 10. Gerencia / Overview

### Mejoras implementadas

- Ajustes de layout para pantallas grandes.
- Mejora de espaciado y tipografia.

### Archivos modificados
- `overview.html`, `overview.ts`, `overview.css`

---

## 11. Backend — API de Consulta (scada-query-api)

### Funcionalidades nuevas

#### 11.1 Sistema de autenticacion mejorado
- **Google Authenticator (TOTP):** Endpoints para setup, verificacion y desactivacion.
- **Bloqueo por intentos fallidos:** 5 intentos → 15 minutos de bloqueo.
- **Token temporal 2FA:** Expira en 5 minutos.

#### 11.2 Entidades organizacionales (nuevo)
- **Tabla `scada.entities`:** CONAGUA (Federal) → OCAVM/CAEM (Estatal) → 6 municipios.
- **API:** `GET /api/v1/entities` (todos los autenticados), `POST /api/v1/entities` (solo Admin).
- **Filtrado por scope:** Usuarios estatales solo ven su estado y municipios hijos.

#### 11.3 Auditoria mejorada
- **`GET /api/v1/audit/logs`:** Listado paginado con filtros por fecha y usuario.
- **`GET /api/v1/audit/logs/export`:** Descarga CSV con todos los registros filtrados.
- **`POST /api/v1/audit/navigation`:** Registro de navegacion entre modulos (ya existia).

#### 11.4 Permisos granulares (nuevo)
- **Tabla `scada.permissions`:** can_view, can_edit, can_export, can_block por usuario.
- **API:** `GET /api/v1/users/:id/permissions`, `PUT /api/v1/users/:id/permissions` (solo Admin).

#### 11.5 Usuarios
- **Filtrado por entidad:** `GET /api/v1/users?entityId=X` filtra usuarios por dependencia.
- **`entity_id` en usuarios:** Cada usuario tiene una dependencia asignada.
- **Nombres de roles normalizados:** Administrador, Supervisor, Operador, Tecnico.

### Archivos nuevos
| Archivo | Descripcion |
|---------|-------------|
| `migrations/001_add_totp_columns.sql` | Columnas TOTP en tabla users |
| `migrations/002_create_entities_table.sql` | Tabla de entidades organizacionales |
| `migrations/003_users_entity_id_and_roles.sql` | FK entity_id + roles normalizados |
| `migrations/004_seed_user_entities.sql` | Asignacion de entidades a usuarios existentes |
| `migrations/005_create_permissions_table.sql` | Tabla de permisos granulares |
| `src/interfaces/entity.interface.ts` | Interfaces de entidades |
| `src/services/entity-service.ts` | CRUD de entidades |
| `src/services/permission-service.ts` | Lectura/escritura de permisos |
| `src/routes/entity-routes.ts` | Rutas de entidades |
| `src/migrate.ts` | Runner de migraciones |
| `src/__tests__/entity-audit.test.ts` | Tests de entidades y auditoria |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/app.ts` | Registro de rutas de entidades |
| `src/routes/auth-routes.ts` | Endpoints TOTP (setup, verify, disable) |
| `src/routes/audit-routes.ts` | GET /logs con paginacion y export CSV |
| `src/routes/user-routes.ts` | Filtro por entityId, endpoints de permisos |
| `src/services/user-service.ts` | Soporte entity_id, listado scoped |
| `src/interfaces/user.interface.ts` | Campo entity_id agregado |
| `src/middlewares/auth-middleware.ts` | Inyeccion de scope en JWT |

---

## 12. Base de datos — Migraciones

5 migraciones aditivas (no modifican ni borran datos existentes):

| # | Archivo | Que hace |
|---|---------|----------|
| 001 | `001_add_totp_columns.sql` | Agrega `totp_secret` y `totp_enabled` a tabla users |
| 002 | `002_create_entities_table.sql` | Crea tabla `scada.entities` + datos semilla (9 entidades) |
| 003 | `003_users_entity_id_and_roles.sql` | Agrega `entity_id` a users + normaliza nombres de roles |
| 004 | `004_seed_user_entities.sql` | Asigna entidades a usuarios existentes segun su scope |
| 005 | `005_create_permissions_table.sql` | Crea tabla `scada.permissions` + permisos por defecto |

**Seguridad:** Todas usan `IF NOT EXISTS` y se ejecutan en transacciones. Ejecutar multiples veces es seguro.

---

## 13. Tests automatizados

- **40 tests pasando** en 3 archivos:
  - `auth.test.ts` — Autenticacion, login, 2FA
  - `email-service.test.ts` — Servicio de correo
  - `entity-audit.test.ts` — Entidades y auditoria
- Todos los servicios externos (PostgreSQL, InfluxDB, SMTP) estan mockeados. No se requiere base de datos para correr tests.

---

## 14. Otros cambios

| Cambio | Descripcion |
|--------|-------------|
| `.gitignore` | Actualizado para ignorar archivos de ambiente |
| `docker-compose.yml` | Ajuste de configuracion de contenedores |
| `angular.json` | Configuracion de build actualizada |
| `package.json` (frontend) | Dependencia agregada |
| `package.json` (backend) | Dependencias: otplib, qrcode, csv-stringify |
| `influx-query-service.ts` | Correccion menor de query |

---

## Resumen de archivos por area

| Area | Archivos nuevos | Archivos modificados | Total |
|------|----------------|---------------------|-------|
| Login / Auth | 0 | 5 | 5 |
| Dashboard | 0 | 2 | 2 |
| Layout (Header + Footer) | 0 | 6 | 6 |
| Telemetria | 0 | 3 | 3 |
| Pozos / Detalle | 0 | 4 | 4 |
| Usuarios (frontend) | 3 | 9 | 12 |
| Perfil de usuario | 0 | 3 | 3 |
| Gerencia | 0 | 3 | 3 |
| Backend API | 6 | 8 | 14 |
| Migraciones BD | 5 | 0 | 5 |
| Tests | 1 | 0 | 1 |
| Config / Otros | 0 | 5 | 5 |
| Imagenes de referencia | 7 | 0 | 7 |
| Documentacion | 2 | 0 | 2 |
| **TOTAL** | **24** | **43** | **76** |

---

## Soporte responsive completo

Todas las pantallas del sistema ahora se adaptan a 3 tamanios:

| Pantalla | Escritorio (>1024px) | Tablet (701-1024px) | Celular (<700px) |
|----------|---------------------|--------------------|--------------------|
| Login | Card centrada 70% | Card 70% | Card 90% |
| Dashboard | Bento grid 2 cols | Grid 2 cols reducido | Grid 1 columna |
| Header | Completo con nombre y rol | Reducido | Compacto, icono solo |
| Footer tabs | 5 tabs con labels | 5 tabs labels reducidos | 5 tabs iconos |
| Telemetria | KPIs 4 cols + tabla + panel | KPIs 2 cols | KPIs 1 col, apilado |
| Pozo detalle | Grafica full width | Grafica adaptada | Grafica scrolleable |
| Usuarios | 3 columnas (arbol+tabla+log) | 2 columnas | Todo apilado |
| Perfil | Card centrada | Card 80% | Card 100% |
| Reporte | Tabla con filtros laterales | Filtros arriba | Todo apilado |
