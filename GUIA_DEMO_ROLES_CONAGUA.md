# Guia de Demostracion: Sistema de Roles y Gestion de Usuarios SCADA-SOA

**Fecha de junta:** 26 de febrero de 2026
**Preparado para:** CONAGUA / OCAVM
**Version:** 1.0

---

## Resumen de lo implementado

| Funcionalidad | Estado |
|---|---|
| 4 roles SOA (Administrador, Supervisor, Operador, Tecnico) | Listo |
| Arbol jerarquico de dependencias (CONAGUA > OCAVM/CAEM > Municipios) | Listo |
| Filtrado de usuarios por dependencia (click en arbol) | Listo |
| Bitacora de auditoria con datos reales (180+ registros) | Listo |
| Reporte de actividad con paginacion | Listo |
| Exportar CSV de auditoria | Listo |
| Permisos granulares por usuario (Ver, Editar, Exportar, Bloquear) | Listo |
| Selector de dependencia al crear/editar usuario | Listo |
| Google Authenticator (TOTP) 2FA | Listo |
| Mapa GIS filtrado por scope (Federal/Estatal/Municipal) | Listo (ya existia) |
| Mejoras de login: limpieza de espacios, ojito para ver contrasena | Listo |
| Recuperacion de contrasena por correo (forgot password) | Listo |

---

## Matriz de acceso por rol

| Ruta | Admin (1) | Supervisor (2) | Operador (3) | Tecnico (4) |
|---|---|---|---|---|
| `/dashboard` | SI | SI | SI | SI |
| `/telemetria` | SI | SI | SI | SI |
| `/modulo-gis` | SI (todos los sitios) | SI (sitios de su estado) | SI (solo su municipio) | SI (solo su municipio) |
| `/usuarios` | SI | BLOQUEADO → dashboard | BLOQUEADO → dashboard | BLOQUEADO → dashboard |
| `/usuarios/nuevo` | SI | BLOQUEADO → dashboard | BLOQUEADO → dashboard | BLOQUEADO → dashboard |
| `/reporte` | SI | SI | SI | SI |
| `/gerencia` | SI | BLOQUEADO → login | BLOQUEADO → login | BLOQUEADO → login |
| `/perfil` | SI | SI | SI | SI |

> **Nota sobre el mapa GIS:** El filtrado geoespacial ya estaba implementado. Admin Federal ve **todo el Estado de Mexico** (~100+ sitios). Un Operador Municipal ve **solo su municipio** con poligono delimitado (~20 sitios).

---

## PREPARACION PREVIA (hacer ANTES de la junta)

### Paso 1: Crear usuarios de prueba con los 4 roles

Actualmente solo existen usuarios con rol Administrador y Tecnico. Para demostrar los 4 roles, hay que crear usuarios Supervisor y Operador.

**Entrar al sistema como Administrador:**
- URL: `https://scada.playtelecom.com` (produccion) o `http://localhost:4200` (local)
- Correo: `anibal.gamboa@playtelecom.com`
- Password: `CAEM_2026_Pilot`
- **Nota:** Si escribes el correo con espacios al inicio o final, el sistema los elimina automaticamente. Tambien puedes hacer click en el icono del "ojito" junto a la contrasena para verificar que la escribiste correctamente antes de entrar.

**Crear los siguientes usuarios de prueba:**

| # | Nombre | Email sugerido | Rol | Nivel | Dependencia | Estado | Password sugerido |
|---|---|---|---|---|---|---|---|
| 1 | Demo Supervisor | supervisor.demo@conagua.gob.mx | **Supervisor** | Estatal | OCAVM | Edo. Mexico | DemoSCADA2026! |
| 2 | Demo Operador | operador.demo@conagua.gob.mx | **Operador** | Municipal | Ecatepec | Edo. Mexico | DemoSCADA2026! |

**Para crear cada uno:**
1. Ir a `/usuarios` > click **"+ Nuevo usuario"**
2. Llenar: Nombre, Correo, Password
3. Seleccionar Rol, Nivel, Dependencia
4. Ajustar permisos (checkboxes)
5. Click **"Guardar"**

### Paso 2: Verificar que puedes iniciar sesion con cada usuario

Probar login con los 4 roles antes de la junta:
1. Admin: `anibal.gamboa@playtelecom.com` / `CAEM_2026_Pilot`
2. Supervisor: `supervisor.demo@conagua.gob.mx` / `DemoSCADA2026!`
3. Operador: `operador.demo@conagua.gob.mx` / `DemoSCADA2026!`
4. Tecnico: `user01@ecatepec.gob.mx` / `DemoSCADA2026!`

> **NOTA:** Si algun usuario tiene 2FA activado, necesitaras el codigo del correo o Google Authenticator. Para la demo es mas fluido desactivar 2FA temporalmente.

### Paso 3: Verificar que el backend esta corriendo

```bash
# En produccion, verificar que el API responde:
curl https://scada.playtelecom.com/api/v1/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"anibal.gamboa@playtelecom.com","password":"CAEM_2026_Pilot"}'
```

Si devuelve `{"token":"..."}` o `{"tempToken":"...","method":"..."}` esta funcionando.

---

## GUION DE LA DEMO (paso a paso)

### Acto 1: Panorama general como Administrador (5 min)

**Login:** Entrar como `anibal.gamboa@playtelecom.com` / `CAEM_2026_Pilot` (Administrador Federal)

> **Tip de la pantalla de login:** Notar que el campo dice "Correo electronico" (no "Usuario"). Si escribes el correo con espacios o mayusculas, el sistema lo corrige automaticamente. Puedes hacer click en el icono del ojo junto a la contrasena para verla mientras la escribes.

**1.1 — Dashboard principal**
- Mostrar el dashboard rediseñado con las 4 tarjetas tipo "Bento Grid"
- Cada tarjeta tiene icono, titulo, descripcion y flecha
- Senalar el header: muestra nombre "Anibal", rol "Administrador"

**1.2 — Modulo de Gestion de Usuarios**
- Navegar a `/usuarios` (click en "Usuarios" en la barra inferior)
- **Mostrar el arbol de dependencias** a la izquierda:
  ```
  Todos
  FEDERAL
    CONAGUA
      ESTATAL
        CAEM
          La Paz
          Tlalnepantla
          Valle de Chalco
        OCAVM
          Chalco
          Chicoloapan
          Ecatepec
  ```
- **Explicar:** "Este arbol refleja la estructura organizacional real: CONAGUA a nivel Federal, OCAVM y CAEM a nivel Estatal, y los municipios debajo de cada organismo."

**1.3 — Tabla de usuarios**
- Mostrar la tabla con columnas: Nombre, Correo, **Rol**, Nivel, **Dependencia**, Estatus
- Senalar que cada usuario tiene su dependencia asignada (CONAGUA, Ecatepec, Chalco, etc.)
- Senalar los 4 roles visibles: Administrador, Supervisor, Operador, Tecnico

### Acto 2: Filtrado jerarquico por dependencia (3 min)

**2.1 — Filtrar por OCAVM**
- Click en **"OCAVM"** en el arbol
- La tabla se filtra y muestra SOLO usuarios de OCAVM y sus municipios hijos (Ecatepec, Chalco, Chicoloapan)
- Senalar el indicador visual "Listado de usuarios . OCAVM"

**2.2 — Filtrar por Ecatepec**
- Click en **"Ecatepec"**
- La tabla muestra SOLO usuarios asignados a Ecatepec
- Explicar: "Cada nivel puede ver solo los usuarios de su jurisdiccion."

**2.3 — Filtrar por CONAGUA**
- Click en **"CONAGUA"**
- Muestra TODOS los usuarios (Federal ve todo)

**2.4 — Reset**
- Click en **"Todos"** para volver a ver todos los usuarios

### Acto 3: Bitacora de auditoria (3 min)

**3.1 — Seguridad Log (panel derecho)**
- En la misma pagina `/usuarios`, senalar el panel derecho "Seguridad Log"
- Muestra las ultimas 10 acciones con: Usuario, Accion, IP, Fecha/Hora
- **Datos reales:** LOGIN_SUCCESS, CREATE_USER_SUCCESS, TOTP_ENABLED, NAVIGATE_TO_MODULE, etc.

**3.2 — Reporte completo de auditoria**
- Click en boton **"Reporte / Auditoria"** (esquina superior del panel)
- Se abre `/reporte` con la bitacora completa
- Mostrar: 180+ registros reales, columnas Usuario, Rol, Accion, IP, Fecha/Hora
- **Paginacion:** "Pagina 1 de 4" con botones Anterior/Siguiente
- Navegar a pagina 2 para mostrar registros mas antiguos

**3.3 — Exportar CSV**
- Click en **"Descargar CSV"**
- Se descarga `reporte_auditoria.csv`
- Abrir en Excel para mostrar: ID, Usuario, Email, Rol, Nivel, Accion, Detalles, IP, Fecha

### Acto 4: Crear un nuevo usuario con rol y dependencia (3 min)

**4.1 — Formulario de creacion**
- Regresar a `/usuarios` > click **"+ Nuevo usuario"**
- Mostrar el formulario con secciones:
  - **Datos basicos:** Nombre, Apellido, Usuario, Correo, Telefono
  - **Seguridad:** Password, 2FA toggle
  - **Rol y alcance:** Dropdown de Rol (4 opciones SOA), Nivel, **Dependencia** (dropdown con entidades reales)
  - **Permisos:** Checkboxes Ver, Editar, Exportar, Bloquear

**4.2 — Seleccionar Rol**
- Abrir dropdown de Rol para mostrar: Administrador, Supervisor, Operador, Tecnico
- Seleccionar "Operador"

**4.3 — Seleccionar Dependencia**
- Abrir dropdown de Dependencia para mostrar las 9 entidades con su nivel entre parentesis:
  - CONAGUA (Federal), OCAVM (Estatal), CAEM (Estatal), Ecatepec (Municipal), etc.

**4.4 — Permisos**
- Mostrar los checkboxes y explicar: "Los permisos son independientes del rol. Un Supervisor puede tener permisos de exportar pero no de bloquear, por ejemplo."

> **NOTA:** No es necesario guardar el usuario de prueba. Solo mostrar el formulario.

### Acto 5: Demostrar diferentes roles con login (5 min)

> Esta es la parte mas impactante. Requiere los usuarios creados en la preparacion.

**5.1 — Cerrar sesion**
- Click en avatar > "Cerrar sesion"

**5.2 — Login como Supervisor (Estatal)**
- Email: `supervisor.demo@conagua.gob.mx` / Password: `DemoSCADA2026!`
- Navegar a `/usuarios`
- **Mostrar:** El arbol solo muestra entidades de su jurisdiccion estatal
- **Mostrar:** El header dice "Demo Supervisor" con rol "Supervisor"
- **Mostrar:** No tiene acceso a crear ni eliminar usuarios (botones ocultos o deshabilitados segun configuracion)

**5.3 — Cerrar sesion y login como Operador (Municipal)**
- Email: `operador.demo@conagua.gob.mx` / Password: `DemoSCADA2026!`
- Navegar a `/usuarios`
- **Mostrar:** Alcance limitado a su municipio

**5.4 — Cerrar sesion y login como Tecnico (Municipal)**
- Email: `user01@ecatepec.gob.mx` / Password: `DemoSCADA2026!`
- **Mostrar:** Solo puede ver datos de Ecatepec
- **Mostrar:** No puede acceder a gestion de usuarios (redireccion o mensaje de acceso denegado)

**5.5 — Regresar a Admin**
- Login con Administrador para cerrar la demo

### Acto 6: Modulo GIS — filtrado geoespacial por rol (3 min)

> Esta es la parte mas visual e impactante para CONAGUA.

**6.1 — GIS como Administrador Federal**
- Navegar a "Modulo SIG" (barra inferior)
- Mostrar el mapa completo: **todo el Estado de Mexico** con decenas de sitios (pozos, estanques, drenajes)
- Activar capas "Red primaria" y "Red secundaria" para mostrar cobertura total
- **Punto clave:** "Como Administrador Federal, veo toda la infraestructura del pais."

**6.2 — Cerrar sesion y entrar como Operador Municipal**
- Login como `operador.demo@conagua.gob.mx` (Operador, Municipal/Ecatepec)
- Ir a "Modulo SIG"
- **El mapa se centra automaticamente en Ecatepec** con poligono delimitado
- Solo se ven los ~20 sitios dentro de ese municipio
- **Punto clave:** "El Operador Municipal solo ve la infraestructura de su jurisdiccion. No puede ver pozos de otros municipios."

**6.3 — Regresar a Admin para continuar**

### Acto 7: Recuperacion de contrasena (2 min, opcional)

**7.1 — Mostrar el flujo**
- En la pantalla de login, hacer click en **"¿Olvidaste tu contrasena?"**
- Se abre una pantalla limpia que pide solo el correo electronico
- Escribir un correo y hacer click en **"Enviar enlace de recuperacion"**
- **Mostrar:** El sistema siempre dice "Si existe una cuenta con ese correo, recibiras un enlace..." (por seguridad, nunca revela si el correo existe o no)

**7.2 — Explicar el flujo completo**
- El usuario recibe un correo con un boton "Restablecer contrasena"
- Al hacer click, se abre una pantalla para escribir la nueva contrasena
- Tiene indicadores en tiempo real: minimo 8 caracteres, mayuscula, minuscula, numero
- El enlace expira en 30 minutos y solo se puede usar una vez

> **Punto clave para CONAGUA:** "Ninguna persona puede usar este flujo para averiguar si un correo existe en el sistema. Tampoco puede reutilizar un enlace ya usado."

### Acto 8: Perfil y 2FA (2 min, opcional)

**8.1 — Perfil de usuario**
- Click en avatar > "Mi perfil"
- Mostrar campos: Nombre, Correo, **Rol** (Administrador), Nivel (Federal)

**8.2 — Google Authenticator**
- Mostrar el boton "Activar Google Authenticator"
- Explicar: "Los usuarios pueden activar autenticacion de dos factores con Google Authenticator, lo cual genera un codigo de 6 digitos que cambia cada 30 segundos."
- **(Opcional)** Activar TOTP en vivo: escanear QR con Google Authenticator, ingresar codigo de 6 digitos

---

## Tabla resumen de usuarios para la demo

| Rol | Email | Password | Dependencia |
|---|---|---|---|
| **Administrador** | anibal.gamboa@playtelecom.com | `CAEM_2026_Pilot` | CONAGUA (Federal) |
| **Supervisor** | supervisor.demo@conagua.gob.mx | `DemoSCADA2026!` | OCAVM (Estatal) |
| **Operador** | operador.demo@conagua.gob.mx | `DemoSCADA2026!` | Ecatepec (Municipal) |
| **Tecnico** | user01@ecatepec.gob.mx | `DemoSCADA2026!` | Ecatepec (Municipal) |

---

## Jerarquia de roles (SOA)

```
Administrador (role_id=1)
  |-- Puede: Todo (CRUD usuarios, configuracion, bloquear)
  |-- Scope: Federal (ve toda la republica)
  |
  +-- Supervisor (role_id=2)
        |-- Puede: Ver, Editar, Exportar (sin bloquear ni eliminar)
        |-- Scope: Estatal (ve su estado y municipios)
        |
        +-- Operador (role_id=3)
              |-- Puede: Ver, Editar (sin exportar ni bloquear)
              |-- Scope: Municipal (ve su municipio)
              |-- Puede: Controlar bombas (START/STOP)
              |
              +-- Tecnico (role_id=4)
                    |-- Puede: Solo Ver (lectura)
                    |-- Scope: Municipal (ve su municipio)
```

---

## Jerarquia de dependencias (entidades)

```
CONAGUA (Federal)
  |
  +-- OCAVM (Estatal - Edo. Mexico)
  |     |-- Ecatepec (Municipal)
  |     |-- Chalco (Municipal)
  |     +-- Chicoloapan (Municipal)
  |
  +-- CAEM (Estatal - Edo. Mexico)
        |-- Tlalnepantla (Municipal)
        |-- Valle de Chalco (Municipal)
        +-- La Paz (Municipal)
```

---

## Posibles preguntas de CONAGUA y respuestas

**P: "Pueden agregar mas dependencias/municipios?"**
R: Si. El Administrador puede crear nuevas entidades desde el formulario. La tabla `scada.entities` es extensible. Se puede agregar cualquier municipio o dependencia estatal.

**P: "El log de auditoria registra todo?"**
R: Si. Cada login, creacion de usuario, navegacion a modulos, activacion/desactivacion de 2FA, y bloqueo de usuarios queda registrado con: usuario, accion, IP y fecha/hora.

**P: "Se puede exportar el log?"**
R: Si. El boton "Descargar CSV" exporta todos los registros filtrados a un archivo CSV compatible con Excel.

**P: "Que pasa si alguien intenta acceder a algo que no le corresponde?"**
R: El backend valida el JWT en cada peticion. Si un Tecnico intenta acceder a `/api/v1/users` (solo Admin), recibe un error 403 Forbidden. El frontend tambien oculta las opciones no permitidas.

**P: "Se puede activar 2FA obligatorio?"**
R: Si. Cada usuario tiene un toggle de "Requerir doble verificacion". Se puede configurar por usuario.

**P: "El mapa tambien se restringe por municipio?"**
R: Si. El modulo GIS filtra automaticamente los sitios segun el nivel del usuario. Federal ve todo, Estatal ve su estado, Municipal ve solo su municipio con poligono delimitado. No se necesita configurar nada adicional.

**P: "Que pasa si un usuario olvida su contrasena?"**
R: En la pantalla de login hay un enlace "¿Olvidaste tu contrasena?". El usuario ingresa su correo y recibe un enlace por email para crear una nueva contrasena. El enlace expira en 30 minutos y solo se puede usar una vez.

**P: "Esto ya funciona en produccion?"**
R: Las migraciones de base de datos ya estan listas. Se requiere ejecutar `npm run migrate` en produccion para aplicar los cambios (6 migraciones). El proceso es seguro: usa `IF NOT EXISTS` y transacciones.

---

## Checklist pre-demo

- [ ] Crear usuario demo Supervisor (Estatal/OCAVM)
- [ ] Crear usuario demo Operador (Municipal/Ecatepec)
- [ ] Verificar login con los 4 roles
- [ ] Verificar que la URL de produccion/demo esta accesible
- [ ] Tener abierta una ventana de incognito para cambiar rapido entre usuarios
- [ ] Tener este documento abierto como referencia durante la junta

---

## Notas tecnicas (solo para el equipo de desarrollo)

### Migraciones pendientes en produccion
```bash
cd "Proyecto SCADA/scada-query-api/scada-query-api"
npm run migrate
# Aplica: 002_create_entities_table, 003_users_entity_id_and_roles,
#         004_seed_user_entities, 005_create_permissions_table,
#         006_add_password_reset_columns
```

### Archivos clave modificados
- Backend: `user-service.ts`, `entity-service.ts`, `entity-routes.ts`, `audit-routes.ts`, `permission-service.ts`
- Frontend: `usuarios.ts/html`, `reporte-actividad.ts/html`, `usuario-detalle.ts/html`, `perfil-usuario.ts`
- Constante de roles: `src/app/core/constants/roles.ts`
- Tests: 40/40 pasando (3 archivos de test)
