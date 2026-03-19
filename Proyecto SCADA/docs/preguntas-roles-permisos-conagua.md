# Preguntas para CONAGUA — Definicion de Roles, Permisos y Compartir

**Proyecto:** SOA - Sistema Operativo del Agua
**Fecha:** 17 de marzo 2026
**Objetivo:** Confirmar las reglas del sistema de roles y permisos para implementacion correcta. Necesitamos respuestas concretas para cada seccion.

---

## SECCION 1: Jerarquia de control

Proponemos que el sistema funcione con 3 capas independientes:

| Capa | Que controla | Ejemplo |
|------|-------------|---------|
| **Scope** (Nivel + Estado + Municipio) | Que DATOS puede ver el usuario | Un usuario Municipal Ecatepec solo ve pozos de Ecatepec |
| **Rol** (Admin/Supervisor/Operador/Tecnico) | Que FUNCIONES del sistema puede acceder | Solo Admin puede gestionar usuarios |
| **Permisos** (Ver/Editar/Exportar/Bloquear/Operar/Sinopticos) | Restriccion granular dentro de su rol | Un Admin sin permiso "Exportar" no puede descargar reportes |

**Pregunta 1.1:** Confirman que el scope (territorio) NUNCA se viola? Es decir:
- Un Admin Municipal de Ecatepec NO puede ver datos de Chalco bajo ninguna circunstancia
- Un Admin Estatal puede ver todos los municipios de su estado pero NO de otros estados
- Solo un Admin Federal puede ver todo el pais

> **Respuesta CONAGUA:**
>
>

**Pregunta 1.2:** Los permisos granulares RESTRINGEN al rol, o lo AMPLIAN?

Opcion A (recomendada): Los permisos solo pueden QUITAR capacidades del rol. Un Tecnico con "Operar bombas" activado NO puede operar porque su rol no lo permite.

Opcion B: Los permisos AMPLIAN el rol. Un Tecnico con "Operar bombas" activado SI puede operar aunque su rol normalmente no lo permita.

> **Respuesta CONAGUA (A o B):**
>
>

---

## SECCION 2: Matriz de Roles vs Funciones

Necesitamos confirmar que puede hacer cada rol EN CUANTO A FUNCIONES DEL SISTEMA (independiente de permisos granulares):

| Funcion del sistema | Admin | Supervisor | Operador | Tecnico |
|---------------------|-------|------------|----------|---------|
| Gestionar usuarios (crear/editar/bloquear) | Si | ? | No | No |
| Gestionar entidades (organigrama) | Si | ? | No | No |
| Configurar alarmas (crear/editar umbrales) | Si | Si | ? | No |
| Controlar bombas (START/STOP) | Si | Si | No | No |
| Ver telemetria en tiempo real | Si | Si | Si | Si |
| Ver graficas historicas | Si | Si | Si | Si |
| Crear proyectos de sinopticos | Si | Si | ? | ? |
| Crear/editar sinopticos | Si | Si | ? | ? |
| Ver sinopticos (solo lectura) | Si | Si | Si | Si |
| Exportar reportes y datos | Si | Si | ? | ? |
| Ver bitacora de auditoria | Si | Si | No | No |
| Gestionar capas GIS | Si | ? | No | No |

**Pregunta 2.1:** Completen los signos "?" en la tabla de arriba.

> **Respuesta CONAGUA:**
>
>

**Pregunta 2.2:** Un Supervisor puede gestionar usuarios (crear/editar operadores y tecnicos bajo su mando)?

> **Respuesta CONAGUA:**
>
>

---

## SECCION 3: Permisos granulares

Actualmente tenemos 6 permisos que se asignan POR USUARIO al crearlo o editarlo:

| Permiso | Descripcion | Default Admin | Default Supervisor | Default Operador | Default Tecnico |
|---------|-------------|---------------|-------------------|-----------------|----------------|
| **Ver** | Consultar datos, telemetria, graficas | Si | Si | Si | Si |
| **Editar** | Modificar registros, configuraciones | Si | Si | Si | No |
| **Exportar** | Descargar reportes CSV/PDF | Si | Si | No | No |
| **Bloquear** | Desactivar cuentas de usuarios | Si | No | No | No |
| **Operacion** | Paro/arranque de bombas | Si | Si | No | No |
| **Editar sinopticos** | Crear y modificar sinopticos | Si | Si | No | No |

**Pregunta 3.1:** Estan de acuerdo con estos 6 permisos y sus defaults? Falta alguno? Sobra alguno?

> **Respuesta CONAGUA:**
>
>

**Pregunta 3.2:** Necesitan permisos adicionales? Ejemplos que hemos considerado:
- Gestionar alarmas (crear/editar reglas de alarma)
- Gestionar GIS (subir capas, editar)
- Ver auditoria
- Administrar usuarios

> **Respuesta CONAGUA:**
>
>

**Pregunta 3.3:** Cuando un Admin crea un usuario y selecciona el rol, los permisos se preseleccionan automaticamente segun la tabla de arriba. El Admin puede despues MODIFICAR esos permisos individualmente (por ejemplo, darle "Exportar" a un Operador que normalmente no lo tiene). Estan de acuerdo con este flujo?

> **Respuesta CONAGUA:**
>
>

---

## SECCION 4: Compartir sinopticos, proyectos y vistas de variables

El sistema permite COMPARTIR recursos con otros usuarios. Esto genera un segundo nivel de permisos ESPECIFICO al recurso compartido.

### Como funciona:

```
Juan (Admin Ecatepec) crea el Proyecto "Red Norte"
  → Juan INVITA a Maria (Operadora Ecatepec) con permiso "Edicion"
  → Juan INVITA a Pedro (Tecnico Ecatepec) con permiso "Lectura"

Maria puede editar los sinopticos del proyecto "Red Norte"
Pedro solo puede verlos
```

**Pregunta 4.1:** Cuando se comparte un recurso, los permisos de compartir (Lectura/Edicion) son INDEPENDIENTES de los permisos del usuario?

Ejemplo: Pedro es Tecnico y NO tiene el permiso global "Editar sinopticos". Pero Juan lo invita con permiso "Edicion" al proyecto "Red Norte".

Opcion A: Pedro PUEDE editar ese proyecto especifico aunque globalmente no tenga permiso de editar sinopticos. El permiso de compartir es un "pase especial" para ese recurso.

Opcion B: Pedro NO puede editar. Su permiso global "Editar sinopticos = No" bloquea incluso si lo invitaron con Edicion. Solo podra ver.

> **Respuesta CONAGUA (A o B):**
>
>

**Pregunta 4.2:** Se puede compartir con usuarios de OTRO municipio?

Ejemplo: Juan (Ecatepec) comparte un sinoptico con Luis (Chalco). Luis normalmente no ve datos de Ecatepec.

Opcion A: SI se permite. Al compartir, Luis puede ver ESE sinoptico aunque tenga datos de Ecatepec. Es una excepcion controlada.

Opcion B: NO se permite. Solo se puede compartir con usuarios del mismo scope (mismo municipio/estado).

> **Respuesta CONAGUA (A o B):**
>
>

**Pregunta 4.3:** Que recursos se pueden compartir?

| Recurso | Se puede compartir? | Permisos al compartir |
|---------|--------------------|-----------------------|
| Proyecto completo (con todos sus sinopticos) | ? | Lectura / Edicion |
| Sinoptico individual | ? | Lectura / Edicion |
| Vista de variables | ? | Lectura / Edicion |
| Graficas personales | ? | Lectura / Edicion |

> **Respuesta CONAGUA:**
>
>

---

## SECCION 5: Casos especificos

Por favor confirmen como debe comportarse el sistema en cada caso:

**Caso 5.1 — Admin Municipal limitado**
Se crea un usuario con Rol=Admin, Nivel=Municipal, Municipio=Ecatepec, y se le QUITA el permiso "Editar".
- Puede gestionar usuarios de Ecatepec? (es funcion del rol Admin)
- Puede modificar configuraciones de sitios de Ecatepec? (requiere permiso "Editar")

> **Respuesta CONAGUA:**
>
>

**Caso 5.2 — Supervisor Federal**
Se crea un usuario con Rol=Supervisor, Nivel=Federal.
- Puede ver datos de TODOS los estados y municipios?
- Puede controlar bombas de cualquier municipio?
- Puede crear alarmas para cualquier municipio?

> **Respuesta CONAGUA:**
>
>

**Caso 5.3 — Tecnico con permisos especiales**
Se crea un Tecnico Municipal de Chalco. El admin le activa "Exportar" y "Editar sinopticos".
- Puede descargar reportes de Chalco?
- Puede crear sus propios sinopticos?
- Puede editar sinopticos de otros usuarios?

> **Respuesta CONAGUA:**
>
>

**Caso 5.4 — Operador invitado a sinoptico**
Maria es Operadora de Ecatepec. Juan (Admin) la invita al sinoptico "Tablero General" con permiso "Edicion".
Maria NO tiene el permiso global "Editar sinopticos".
- Maria puede editar ESE sinoptico?
- Maria puede crear sinopticos NUEVOS?

> **Respuesta CONAGUA:**
>
>

---

## SECCION 6: Resumen para confirmar

Marquen con SI o NO cada afirmacion:

| # | Afirmacion | SI/NO |
|---|-----------|-------|
| 1 | El scope (territorio) NUNCA se viola, ni siquiera para Admins | |
| 2 | Los permisos granulares solo RESTRINGEN, nunca amplian el rol | |
| 3 | Al crear un usuario, los permisos se preseleccionan segun el rol | |
| 4 | Un Admin puede modificar los permisos de cualquier usuario de su scope | |
| 5 | Compartir un recurso da acceso SOLO a ese recurso, no a todo el scope | |
| 6 | Se puede compartir con usuarios de diferente municipio | |
| 7 | El permiso de compartir (Lectura/Edicion) es independiente de los permisos globales del usuario | |
| 8 | Solo Admin y Supervisor pueden crear proyectos de sinopticos | |
| 9 | Controlar bombas requiere Rol=Supervisor + Permiso=Operacion | |
| 10 | Un usuario bloqueado no puede iniciar sesion bajo ninguna circunstancia | |

> **Respuestas CONAGUA:**
>
>

---

**Notas para PlayTelecom (no enviar a CONAGUA):**
- Con las respuestas de este documento, implementaremos:
  1. Seed de permisos al crear usuario (bug actual)
  2. Preseleccion de permisos en UI al cambiar rol
  3. Logica de compartir consistente con permisos globales vs locales
  4. Scope enforcement en todos los endpoints
- Guardar las respuestas en memoria del proyecto para referencia futura
