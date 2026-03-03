# Guia de Pruebas Manuales — Sistema de Roles RBAC

## Credenciales de prueba

| Usuario | Email | Password | Rol | Scope | 2FA |
|---|---|---|---|---|---|
| Orlando | orlando.soto@opt.org.mx | 1234 | Administrador (1) | Federal | Email |
| Carmen | carmen.rodriguez@playtelecom.com | 1234 | Administrador (1) | Federal | Email |
| User 01 | user01@ecatepec.gob.mx | 1234 | Tecnico (4) | Municipal — Ecatepec | No |
| User 02 | user02@chalco.gob.mx | 1234 | Tecnico (4) | Municipal — Chalco | No |
| User 03 | user03@ixtapaluca.gob.mx | 1234 | Tecnico (4) | Municipal — Ixtapaluca | No |

> **Nota:** Los admins tienen 2FA por email activado. Despues de ingresar email + password, se envia un codigo de 6 digitos al correo. Los tecnicos entran directo sin 2FA.

---

## PRUEBA 1: Login como Administrador

1. Ir a `http://localhost:4200/login` (o `https://scada.playtelecom.com`)
2. Ingresar: `orlando.soto@opt.org.mx` / `1234`
3. El sistema muestra pantalla de 2FA — revisar email de Orlando para el codigo de 6 digitos
4. Ingresar el codigo

**Verificar:**
- [ ] Header muestra: "Orlando" / "Administrador"
- [ ] Dashboard carga con 4 cards: Telemetria, Modulo SIG, Gestion de Usuarios, Administracion de Proyectos
- [ ] Footer tiene 6 tabs: Inicio, Telemetria, Mapa SIG, Proyectos, Alarmas, **Usuarios**

---

## PRUEBA 2: Admin — Gestion de Usuarios (`/usuarios`)

1. Click en tab "Usuarios" del footer (o en la card "Gestion de Usuarios")

**Verificar:**
- [ ] Se carga la pagina "Gestion de Usuarios"
- [ ] KPIs arriba: Total usuarios (9), Activos (9), Bloqueados (0), Filtrados (9)
- [ ] Arbol de dependencias a la izquierda:
  - Todos (9)
  - FEDERAL → CONAGUA
  - ESTATAL → CAEM → La Paz, Tlalnepantla, Valle de Chalco
  - ESTATAL → OCAVM → Chalco, Chicoloapan, Ecatepec
- [ ] Tabla con 9 usuarios, columnas: Nombre, Correo, Rol, Nivel, Dependencia, Estatus, Acciones
- [ ] Cada fila tiene botones "Editar" y "Revocar acceso"
- [ ] Boton "Nuevo usuario" visible arriba
- [ ] Seccion "Seguridad Log" abajo con ultimos 10 eventos de auditoria

### 2a. Filtrar por dependencia
1. Click en "Ecatepec" en el arbol

**Verificar:**
- [ ] Tabla muestra solo usuarios de Ecatepec (ej: User 01, Enrique)
- [ ] KPI "Filtrados" se actualiza

### 2b. Buscar usuario
1. Escribir "carmen" en el buscador

**Verificar:**
- [ ] Tabla filtra a solo Carmen Rodriguez

### 2c. Ver detalle de usuario
1. Click en boton "Editar" de cualquier usuario

**Verificar:**
- [ ] Se abre formulario con datos del usuario (nombre, apellido, email, telefono, rol, scope)
- [ ] Seccion de permisos con checkboxes: Puede ver, Puede editar, Puede exportar, Puede bloquear
- [ ] Boton "Guardar cambios" visible
- [ ] **NO cambiar nada, solo verificar que carga**

---

## PRUEBA 3: Admin — Telemetria (`/telemetria`)

1. Click en tab "Telemetria" del footer

**Verificar:**
- [ ] Carga la pagina con listado de sitios/pozos
- [ ] Cada pozo muestra: nombre, devEUI, ultimo valor de caudal, estado
- [ ] Se puede hacer click en un pozo para ver detalle con graficas
- [ ] Las graficas muestran datos historicos (si el tunnel SSH a InfluxDB esta activo)

---

## PRUEBA 4: Admin — Mapa SIG (`/modulo-gis`)

1. Click en tab "Mapa SIG" del footer

**Verificar:**
- [ ] Mapa Leaflet carga con **todos** los markers (~46 pozos visibles)
- [ ] Console log: `[GIS] Access: FEDERAL. Loading all sources.`
- [ ] Sidebar izquierdo con leyenda de sitios y estados
- [ ] Se pueden activar capas: Red primaria, Red secundaria, Zonas
- [ ] Click en un municipio (Ecatepec/Ixtapaluca) abre popup con boton "Ver detalle"
- [ ] Click en "Ver detalle" navega a `/gerencia/municipio/:id`

---

## PRUEBA 5: Admin — Resumen de Gasto (`/gerencia/overview-gastos`)

1. Click en tab "Proyectos" del footer

**Verificar:**
- [ ] KPIs: Gasto total (~465 l/s), Pozos activos (28), Municipios (2), Promedio por pozo
- [ ] Mapa con 2 municipios coloreados: Ecatepec e Ixtapaluca
- [ ] Cada municipio tiene tooltip con nombre y gasto en l/s
- [ ] Click en un municipio navega al detalle

---

## PRUEBA 6: Admin — Perfil (`/perfil`)

1. Click en el avatar "OR" del header → dropdown → "Perfil" (o ir a `/perfil`)

**Verificar:**
- [ ] Muestra: Orlando, Administrador, Federal
- [ ] Boton "Cambiar contrasena"
- [ ] Seccion "Seguridad" con Google Authenticator: estado Desactivado, boton "Activar"

---

## PRUEBA 7: Admin — Reporte de Auditoria (`/reporte`)

1. Ir a `/reporte` (o desde el boton "Reporte completo" en `/usuarios`)

**Verificar:**
- [ ] Tabla de auditoria con columnas: Usuario, Accion, IP, Fecha/Hora
- [ ] Eventos visibles: LOGIN_SUCCESS, TOTP_ENABLED, TOTP_DISABLED, etc.
- [ ] Filtros por fecha y usuario
- [ ] Boton "Exportar CSV"

---

## PRUEBA 8: Cerrar sesion Admin

1. Click en avatar del header → "Cerrar sesion"

**Verificar:**
- [ ] Redirige a `/login`
- [ ] localStorage limpio (no hay `scada_token`)

---

---

## PRUEBA 9: Login como Tecnico

1. Ir a `/login`
2. Ingresar: `user01@ecatepec.gob.mx` / `1234`
3. **No pide 2FA** — entra directo

**Verificar:**
- [ ] Header muestra: "User 01" / "Tecnico"
- [ ] Dashboard carga normalmente

---

## PRUEBA 10: Tecnico — Acceso DENEGADO a Usuarios

1. Click en tab "Usuarios" del footer

**Verificar:**
- [ ] **NO carga** la pagina de usuarios
- [ ] Redirige automaticamente a `/dashboard`
- [ ] Console warning: `[RoleGuard] Acceso denegado. Usuario..., se requiere <= 1`

### 10a. Intento directo por URL
1. Escribir en la barra de direccion: `http://localhost:4200/usuarios`
2. Enter

**Verificar:**
- [ ] Redirige a `/dashboard`

3. Intentar: `http://localhost:4200/usuarios/nuevo`

**Verificar:**
- [ ] Redirige a `/dashboard`

4. Intentar: `http://localhost:4200/usuarios/2/editar`

**Verificar:**
- [ ] Redirige a `/dashboard`

---

## PRUEBA 11: Tecnico — Mapa SIG filtrado por scope

1. Click en tab "Mapa SIG"

**Verificar:**
- [ ] Console log: `[GIS] Access: MUNICIPAL (ID: 33). Single municipality view.`
- [ ] Mapa muestra **solo pozos de Ecatepec** (menos markers que el admin)
- [ ] El mapa esta centrado/zoomed en la zona de Ecatepec
- [ ] **NO se ven pozos de Ixtapaluca ni Chalco**

---

## PRUEBA 12: Tecnico — Acceso PERMITIDO a modulos generales

1. Click en "Telemetria" → **Verificar:** carga normalmente
2. Click en "Proyectos" (overview-gastos) → **Verificar:** carga normalmente
3. Ir a `/perfil` → **Verificar:** muestra "User 01", "Tecnico", "Municipal"
4. Ir a `/reporte` → **Verificar:** la pagina carga pero muestra error al cargar logs (403 — esperado, los logs de auditoria son solo para admin)

---

## PRUEBA 13: Tecnico — API protegida (prueba con DevTools)

1. Abrir DevTools del browser (F12) → Console
2. Ejecutar:

```javascript
// Intentar acceder a endpoint admin-only
fetch('/api/v1/users', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('scada_token') }
}).then(r => console.log('GET /users:', r.status));
// Esperado: 403
```

```javascript
// Intentar crear usuario (admin-only)
fetch('/api/v1/users', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('scada_token'),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({full_name:'Hacker',email:'hack@test.com',password:'1234',role_id:1})
}).then(r => console.log('POST /users:', r.status));
// Esperado: 403
```

```javascript
// Intentar bloquear admin (admin-only)
fetch('/api/v1/users/2/block', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('scada_token'),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({is_blocked:true})
}).then(r => console.log('PATCH /users/2/block:', r.status));
// Esperado: 403
```

```javascript
// Intentar controlar bomba (operator-only, role <= 3)
fetch('/api/v1/control', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('scada_token'),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({devEUI:'test',action:'START'})
}).then(r => console.log('POST /control:', r.status));
// Esperado: 403
```

**Verificar:**
- [ ] Todos devuelven **403 Forbidden**
- [ ] Ningun dato se modifica

---

## PRUEBA 14: Sin sesion — Proteccion de rutas

1. Cerrar sesion del tecnico
2. Intentar navegar directamente a:
   - `http://localhost:4200/dashboard` → **Debe redirigir a `/login`**
   - `http://localhost:4200/usuarios` → **Debe redirigir a `/login`**
   - `http://localhost:4200/telemetria` → **Debe redirigir a `/login`**
   - `http://localhost:4200/modulo-gis` → **Debe redirigir a `/login`**

**Verificar:**
- [ ] Todas las rutas protegidas redirigen a login
- [ ] No se puede acceder a ningun modulo sin autenticacion

---

## PRUEBA 15: Login fallido — Bloqueo de cuenta

1. Ir a `/login`
2. Ingresar email correcto con **password incorrecto** 5 veces seguidas

**Verificar:**
- [ ] Despues de 5 intentos, el mensaje cambia a "Account locked"
- [ ] La cuenta se bloquea por 15 minutos
- [ ] Incluso con password correcto, no permite entrar durante el bloqueo

> **CUIDADO:** No hacer esto con cuentas de produccion reales. Usar solo en ambiente local.

---

## Resumen de resultados esperados

| Prueba | Admin | Tecnico | Sin sesion |
|---|---|---|---|
| Dashboard | OK | OK | Redirige a login |
| Usuarios | OK (CRUD completo) | **BLOQUEADO** (403 + redirect) | Redirige a login |
| Telemetria | OK | OK | Redirige a login |
| Mapa SIG | Todos los pozos (Federal) | Solo su municipio (Municipal) | Redirige a login |
| Overview gastos | OK | OK | Redirige a login |
| Perfil | OK | OK | Redirige a login |
| Reporte auditoria | OK (datos visibles) | Pagina carga, datos 403 | Redirige a login |
| API admin endpoints | 200 | 403 | 401 |
| Control bomba | 200 (si es operator+) | 403 | 401 |

---

## Hallazgos conocidos (no bloqueantes)

1. **UX:** El tab "Usuarios" en el footer es visible para todos los roles. Deberia ocultarse para no-admins.
2. **UX:** La card "Gestion de Usuarios" en el dashboard es visible para tecnicos (el click no hace nada porque el guard bloquea, pero la card no deberia mostrarse).
3. **UX:** La pagina `/reporte` es accesible para tecnicos pero la API devuelve 403 al cargar los logs. Podria mostrar un mensaje tipo "No tienes permisos para ver este reporte" en vez del error.

---

## Guia de Presentacion — Demo del Sistema de Roles paso a paso

> **URL base:** `https://scada.avoqado.io` (o `http://localhost:4200` en local)
>
> Usar dos ventanas del navegador: una en modo normal (Admin) y otra en modo incognito (Tecnico) para comparar lado a lado.

---

### PASO 1: Login como Administrador (ventana normal)

1. Abrir: **https://scada.avoqado.io/login**
2. Ingresar:
   - Email: `orlando.soto@opt.org.mx`
   - Password: `1234`
3. Click "Entrar"
4. Aparece pantalla de **verificacion 2FA** — revisar email de Orlando para el codigo de 6 digitos
5. Ingresar codigo → entra al sistema

**Mostrar:** El header dice **"Orlando — Administrador"**

---

### PASO 2: Login como Tecnico (ventana incognito)

1. Abrir en incognito: **https://scada.avoqado.io/login**
2. Ingresar:
   - Email: `user01@ecatepec.gob.mx`
   - Password: `1234`
3. Click "Entrar"
4. **Entra directo** (sin 2FA)

**Mostrar:** El header dice **"User 01 — Tecnico"**

**Punto a destacar:** El admin tiene doble factor de autenticacion obligatorio. El tecnico entra con solo usuario y contrasena.

---

### PASO 3: Comparar Dashboard

**Admin:** https://scada.avoqado.io/dashboard
**Tecnico:** https://scada.avoqado.io/dashboard

**Mostrar:** Ambos ven el dashboard con las 4 cards (Telemetria, SIG, Usuarios, Proyectos). La diferencia se nota al hacer click en cada modulo.

---

### PASO 4: Gestion de Usuarios — Solo Admin

**Admin:** https://scada.avoqado.io/usuarios

**Mostrar en Admin:**
- Tabla con los 9 usuarios del sistema
- KPIs: Total, Activos, Bloqueados
- Arbol de dependencias a la izquierda: CONAGUA → OCAVM/CAEM → Ecatepec, Chalco, etc.
- Botones "Editar" y "Revocar acceso" en cada fila
- Boton "Nuevo usuario" arriba
- Seccion "Seguridad Log" con ultimos eventos de auditoria

**Tecnico:** https://scada.avoqado.io/usuarios

**Mostrar en Tecnico:**
- **No carga.** El sistema redirige automaticamente al dashboard.
- El guard de rol detecta que `role_id=4` no tiene permiso (se requiere `role_id <= 1`).

**Punto a destacar:** El backend tambien protege — aunque alguien manipule la URL, la API devuelve 403.

---

### PASO 5: Crear usuario — Solo Admin

**Admin:** https://scada.avoqado.io/usuarios/nuevo

**Mostrar en Admin:**
- Formulario completo: nombre, apellido, email, telefono, password
- Selector de rol (Administrador, Supervisor, Operador, Tecnico)
- Selector de scope (Federal, Estatal, Municipal)
- Selector de dependencia (CONAGUA, OCAVM, CAEM, municipios)
- Checkboxes de permisos granulares

**Tecnico:** https://scada.avoqado.io/usuarios/nuevo

**Mostrar en Tecnico:**
- **Bloqueado.** Redirige a dashboard.

---

### PASO 6: Editar usuario — Solo Admin

**Admin:** https://scada.avoqado.io/usuarios/4/editar

**Mostrar en Admin:**
- Formulario prellenado con datos de User 01
- Se puede cambiar rol, scope, permisos
- Boton "Guardar cambios"

**Tecnico:** https://scada.avoqado.io/usuarios/4/editar

**Mostrar en Tecnico:**
- **Bloqueado.** Redirige a dashboard.

---

### PASO 7: Mapa SIG — Datos filtrados por scope

**Admin:** https://scada.avoqado.io/modulo-gis

**Mostrar en Admin:**
- Mapa con **todos los pozos** de todos los municipios (~250 markers)
- Console log (F12): `[GIS] Access: FEDERAL. Loading all sources.`

**Tecnico:** https://scada.avoqado.io/modulo-gis

**Mostrar en Tecnico:**
- Mapa con **solo pozos de Ecatepec** (~60 markers)
- El mapa se centra automaticamente en la zona de Ecatepec
- Console log (F12): `[GIS] Access: MUNICIPAL (ID: 33). Single municipality view.`

**Punto a destacar:** Mismo modulo, misma URL, pero los datos se filtran automaticamente segun el scope del usuario. Un tecnico de Ecatepec NO ve los pozos de Ixtapaluca ni Chalco.

---

### PASO 8: Telemetria — Acceso para ambos

**Admin:** https://scada.avoqado.io/telemetria
**Tecnico:** https://scada.avoqado.io/telemetria

**Mostrar:** Ambos pueden ver la telemetria en tiempo real. Las graficas de caudal, presion y estado de bombas son accesibles para todos los roles autenticados.

---

### PASO 9: Resumen de Gasto — Acceso para ambos

**Admin:** https://scada.avoqado.io/gerencia/overview-gastos
**Tecnico:** https://scada.avoqado.io/gerencia/overview-gastos

**Mostrar:**
- KPIs: 465 l/s gasto total, 28 pozos activos, 2 municipios
- Mapa con Ecatepec (118.63 l/s) e Ixtapaluca (346.66 l/s)
- Ambos roles tienen acceso a esta vista panoramica

---

### PASO 10: Reporte de Auditoria

**Admin:** https://scada.avoqado.io/reporte

**Mostrar en Admin:**
- Tabla con eventos: LOGIN_SUCCESS, TOTP_ENABLED, TOTP_DISABLED
- Filtros por fecha y usuario
- Boton "Exportar CSV"

**Tecnico:** https://scada.avoqado.io/reporte

**Mostrar en Tecnico:**
- La pagina se abre pero **no se cargan los datos** (error 403 del API)

**Punto a destacar:** La auditoria es exclusiva del administrador. Registra todos los accesos, cambios de configuracion y eventos de seguridad.

---

### PASO 11: Perfil de usuario

**Admin:** https://scada.avoqado.io/perfil

**Mostrar en Admin:**
- Nombre: Orlando, Rol: Administrador, Scope: Federal
- Boton "Cambiar contrasena"
- Seccion Google Authenticator con boton "Activar"

**Tecnico:** https://scada.avoqado.io/perfil

**Mostrar en Tecnico:**
- Nombre: User 01, Rol: Tecnico, Scope: Municipal
- Mismas opciones de contrasena y TOTP

---

### PASO 12: Proteccion sin sesion

1. Cerrar sesion del Tecnico (click avatar → "Cerrar sesion")
2. Intentar ir a: **https://scada.avoqado.io/dashboard**

**Mostrar:** Redirige automaticamente a `/login`. No se puede acceder a ningun modulo sin autenticacion.

3. Intentar ir a: **https://scada.avoqado.io/usuarios**

**Mostrar:** Tambien redirige a `/login`. Doble proteccion: authGuard + roleGuard.

---

### PASO 13: Bloqueo por intentos fallidos (opcional)

> **Solo en ambiente local.** No hacerlo en produccion con cuentas reales.

1. Ir a: **https://scada.avoqado.io/login**
2. Ingresar email correcto con password incorrecto 5 veces

**Mostrar:** Despues de 5 intentos la cuenta se bloquea por 15 minutos. Incluso con el password correcto, no deja entrar.

---

## Tabla resumen para la presentacion

### Acceso por pagina

| Pagina | URL | Admin | Tecnico | Sin sesion |
|---|---|---|---|---|
| Login | `/login` | — | — | Pagina publica |
| Dashboard | `/dashboard` | Si | Si | Redirige a login |
| Usuarios (lista) | `/usuarios` | Si | **Bloqueado** | Redirige a login |
| Crear usuario | `/usuarios/nuevo` | Si | **Bloqueado** | Redirige a login |
| Editar usuario | `/usuarios/:id/editar` | Si | **Bloqueado** | Redirige a login |
| Telemetria | `/telemetria` | Si | Si | Redirige a login |
| Mapa SIG | `/modulo-gis` | Si (todos los pozos) | Si (solo su municipio) | Redirige a login |
| Resumen gasto | `/gerencia/overview-gastos` | Si | Si | Redirige a login |
| Perfil | `/perfil` | Si | Si | Redirige a login |
| Reporte auditoria | `/reporte` | Si (con datos) | Si (sin datos, 403) | Redirige a login |
| Alarmas | `/dashboard/alarmas` | Si | Si | Redirige a login |

### Acceso por API

| Endpoint | Descripcion | Admin | Tecnico | Sin token |
|---|---|---|---|---|
| `GET /api/v1/users` | Listar usuarios | 200 | **403** | 401 |
| `POST /api/v1/users` | Crear usuario | 200 | **403** | 401 |
| `PUT /api/v1/users/:id` | Editar usuario | 200 | **403** | 401 |
| `PATCH /api/v1/users/:id/block` | Bloquear usuario | 200 | **403** | 401 |
| `POST /api/v1/users/:id/reset-password` | Reset contrasena | 200 | **403** | 401 |
| `GET /api/v1/audit/logs` | Logs auditoria | 200 | **403** | 401 |
| `POST /api/v1/control` | Control bomba | 200 | **403** | 401 |
| `GET /api/v1/sites` | Listar sitios | 200 | 200 | 401 |
| `GET /api/v1/telemetry/:dev/:meas` | Telemetria | 200 | 200 | 401 |

### Visibilidad de datos

| Dato | Admin (Federal) | Tecnico (Municipal) |
|---|---|---|
| Pozos en mapa GIS | Todos (~250 markers) | Solo su municipio (~60) |
| Arbol de dependencias | CONAGUA → OCAVM/CAEM → 6 municipios | No aplica |
| Tabla de usuarios | 9 usuarios | No aplica |
| Logs de auditoria | Todos los eventos | No aplica |

### Resumen ejecutivo

- **Administrador (role_id=1, Federal):** Control total. Gestiona usuarios, roles, permisos y auditoria. Ve todos los pozos de todos los municipios. Tiene 2FA obligatorio por email.
- **Tecnico (role_id=4, Municipal):** Solo consulta. Ve telemetria y mapas limitados a su municipio. No puede gestionar usuarios ni ver auditoria. Sin 2FA.
- **Sin sesion:** No accede a nada. Todas las rutas protegidas redirigen al login.
- **Proteccion doble:** Frontend (roleGuard redirige) + Backend (API devuelve 403). Manipular URLs o tokens no sirve.
