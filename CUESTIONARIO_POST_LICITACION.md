# Cuestionario Post-Licitacion — SCADA SOA / CONAGUA

**Fecha:** 26 de febrero de 2026
**Preparado por:** Equipo Tecnico PlayTelecom
**Destinatarios:** CONAGUA, Scrum Master, Equipo Tecnico

---

## Lo que ya sabemos (del GANTT v4 — 15 enero 2026)

El proyecto tiene **12 modulos**, inicio 1 enero 2026, con fechas limite entre enero y abril 2026. Hoy (26 feb) estamos en Semana 9. Este cuestionario hace preguntas **especificas** basadas en lo que el GANTT revela y los vacios que encontramos.

| Modulo | Deadline | Avance GANTT | Riesgo |
|--------|----------|--------------|--------|
| 1. Admin y Gobierno | 30 ene | ~60% | Medio |
| 2. Ingesta de datos | 30 ene | ~87% | Bajo |
| 3. Visualizacion | 30 ene | ~55% | Medio |
| 4. Sinopticos | 1 abr | ~11% | ALTO |
| 5. GIS | 27 feb | ~70% | ALTO (vence manana) |
| 6. Alarmas | 29 abr | ~1% | ALTO |
| 7. Reportes | 29 abr | ~1% | ALTO |
| 8. Usuarios (graficas) | 29 abr | ~1% | ALTO |
| 9. Diccionarios | 29 abr | ~1% | ALTO |
| 10. Analiticas/ML/Gemelo | 29 abr | ~1% | ALTO |
| 11. Control Remoto | 29 abr | ~50% | Medio |
| 12. Integraciones | 29 abr | ~1% | ALTO |

**Discrepancia detectada en roles:** El GANTT define 4 roles (Administrador, Editor de sinopticos, Operador, Consulta/directivos). Nosotros implementamos (Administrador, Supervisor, Operador, Tecnico). Necesitamos alinear.

---

## 1. CONTRATO Y ALCANCE — Responder HOY

*El GANTT muestra 12 modulos con valor porcentual de 8.33% cada uno. Necesitamos entender como se mide el avance oficialmente.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 1 | Necesitamos el TDR/SOW completo en PDF. Quien nos lo proporciona? | |
| 2 | El GANTT muestra deadline 29 abril para 7 modulos. Es esa la fecha contractual de entrega final? Hay entrega parcial antes? | |
| 3 | Hay penalizaciones por retraso? Cuales son los SLAs comprometidos? | |
| 4 | Los porcentajes de avance del GANTT (col G) — quien los valida? CONAGUA los acepta tal cual o tienen su propio criterio de aceptacion? | |
| 5 | Cuantas fases de pago tiene el proyecto? Estan ligadas a modulos especificos o a porcentaje global? | |
| 6 | Hay periodo de garantia post-entrega? De cuanto tiempo? | |
| 7 | Quien firma la aceptacion de cada entregable por parte de CONAGUA? Nombre y puesto. | |
| 8 | Se requiere transferencia de conocimiento o capacitacion al personal de CONAGUA? En que formato? | |
| 9 | El codigo es propiedad de CONAGUA o de PlayTelecom? Hay clausulas de propiedad intelectual? | |
| 10 | El GANTT tiene una columna "Comentarios 4 PlayTelecom" — hay un documento de retroalimentacion mas detallado de CONAGUA sobre cada modulo? | |

---

## 2. ROLES Y PERMISOS — Responder HOY (discrepancia critica)

*El GANTT define roles distintos a los que implementamos. Esto bloquea el desarrollo de multiples modulos.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 11 | El GANTT define 4 roles: **Administrador, Editor de sinopticos, Operador, Consulta/directivos**. Nosotros implementamos: **Administrador, Supervisor, Operador, Tecnico**. Cual es la lista oficial de roles? **(CRITICO)** | |
| 12 | El rol "Editor de sinopticos" — es un rol de sistema (con permisos fijos) o es un permiso granular que se asigna a cualquier rol? | |
| 13 | El rol "Consulta/directivos" — es solo lectura en todos los modulos? Puede ver telemetria, GIS, alarmas pero no operar ni editar? | |
| 14 | Existe el rol "Supervisor" que nosotros implementamos? Si no, debemos eliminarlo? | |
| 15 | Necesitamos la **matriz de permisos completa**: para cada rol, que puede hacer en cada modulo (ver, crear, editar, eliminar, operar, exportar). **(CRITICO)** | |
| 16 | Cuantos usuarios totales tendra el sistema? Desglose por rol. | |
| 17 | Un Operador de Ecatepec puede ver datos de Chalco? O el aislamiento por municipio es estricto? | |
| 18 | Un usuario puede tener multiples roles? (ej: Operador + Editor de sinopticos) | |
| 19 | El GANTT menciona "Permisos" en Control Remoto (modulo 11, actividad 57) al 1%. Que permisos especificos se esperan para control de bombas? Quien puede encender/apagar? | |

---

## 3. SINOPTICOS — Responder esta semana (modulo mas atrasado, deadline 1 abril)

*El modulo de sinopticos esta al 1% en 4 de 5 actividades. Es el modulo con mayor riesgo. Necesitamos definicion clara para empezar ya.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 20 | Que es exactamente un "sinoptico" en el contexto de CONAGUA? Un diagrama esquematico del sistema hidraulico (tipo P&ID)? Un dashboard configurable? Un canvas interactivo? Hay un ejemplo visual de referencia? **(CRITICO)** | |
| 21 | "Herramientas de creacion y edicion" — se espera un editor drag-and-drop donde el usuario (rol Editor de sinopticos) arme su propio sinoptico visualmente? O el equipo de desarrollo los crea y el usuario solo consulta? | |
| 22 | "Objetos, imagenes, textos, graficas, relojes, alarmas, variables, etiquetas" — es un canvas tipo SCADA clasico (similar a WinCC, Ignition Vision, iFIX)? Que nivel de complejidad se espera? | |
| 23 | "Vista de variables con funciones aritmeticas y condicionales" — se espera un mini-lenguaje de scripting? O solo formulas simples tipo Excel (suma, promedio, if/then)? Hay documentacion de las funciones requeridas? | |
| 24 | "Bitacora de cambios de sinopticos con recuperacion" — se necesita versionamiento tipo Git (diff entre versiones, rollback a version anterior)? O solo un log de quien edito cuando? | |
| 25 | Cuantos sinopticos se esperan crear? 1 por pozo? 1 por municipio? 1 general del sistema? | |
| 26 | El "Grafico avanzado" (50% avance) — el panel de herramientas de distribucion de fechas, zoom, calendarios — que falta especificamente para llegar al 100%? | |
| 27 | Hay mockups, wireframes o ejemplos visuales de como debe verse un sinoptico terminado? Necesitamos referencia visual urgente. | |

---

## 4. GIS — Responder HOY (deadline 27 febrero)

*El modulo GIS vence manana. Capas base al 80%, pero Geoserver al 1%. Necesitamos saber que se acepta como "entregado".*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 28 | El GIS vence 27 feb. Que se necesita para que CONAGUA acepte este modulo como cumplido? Es negociable la fecha? **(CRITICO)** | |
| 29 | "Falta agregar nuevas capas" — cuales capas faltan exactamente? Red primaria/secundaria ya estan. Que mas se necesita? | |
| 30 | Geoserver (1% avance) — CONAGUA tiene un Geoserver existente al que debamos conectarnos? O debemos levantar uno desde cero? | |
| 31 | Quien proporciona los shapefiles/capas GIS? CONAGUA tiene un equipo de geomatica? Ya tienen los archivos listos? | |
| 32 | Se necesita carga, actualizacion y versionamiento de capas por el usuario? O solo por el equipo tecnico? | |
| 33 | "Objetos mapa embebidos en sinoptico" — esto implica que el mapa GIS debe poder insertarse dentro de un sinoptico? Como un componente reutilizable? | |

---

## 5. ALARMAS — Responder esta semana (0% avance, deadline 29 abril)

*Todo el modulo esta sin avance. Necesitamos especificaciones para empezar desarrollo inmediatamente.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 34 | **Alarmas de comunicacion:** "Fallas en comunicaciones y energia" — que define una falla de comunicacion? Cuanto tiempo sin reportar un dispositivo para que se genere alarma? (5min? 30min? 1hr?) **(CRITICO)** | |
| 35 | **Alarmas por umbral:** Necesitamos la tabla completa de umbrales por variable. Ejemplo: presion > X kg/cm2 = alarma critica, caudal < Y L/s = alarma de advertencia. Quien define estos valores? | |
| 36 | Los umbrales son iguales para todos los pozos o varian por sitio? (un pozo puede tener presion normal a 5 kg/cm2 mientras otro a 3 kg/cm2) | |
| 37 | **Historico de alarmas:** Por cuanto tiempo se conserva? Hay requisito regulatorio? | |
| 38 | **Notificaciones WhatsApp:** Ya tienen cuenta de WhatsApp Business API? O debemos configurar una? Cual es el proveedor preferido (Twilio, Meta directo, otro)? | |
| 39 | A quienes se envian las notificaciones WhatsApp? Solo al operador del municipio? Al supervisor? Hay cadena de escalamiento? | |
| 40 | Se necesita reconocimiento (acknowledge) de alarmas? Un operador debe "aceptar" la alarma para que deje de notificar? | |
| 41 | Se necesita supresion de alarmas por mantenimiento programado? (silenciar un pozo durante X horas) | |
| 42 | Las alarmas deben generar tickets automaticos en algun sistema? (Neptuno, Neza Crece, otro?) | |

---

## 6. REPORTES — Responder esta semana (0% avance, deadline 29 abril)

*Tres actividades sin avance: reportes configurables, exportacion, reporte base de operacion.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 43 | "Reportes con parametros configurables" — que reportes se necesitan? Necesitamos una lista con: nombre del reporte, datos que incluye, frecuencia, destinatario. **(CRITICO)** | |
| 44 | "Exportar graficas, Excel, PDF, imagenes" — las graficas actuales de telemetria (ECharts) ya necesitan boton de exportar? O es un modulo separado? | |
| 45 | "Reporte base de operacion y seguimiento" — hay un formato existente que CONAGUA use actualmente (en papel o Excel) que debamos digitalizar? Necesitamos una copia. | |
| 46 | Se necesita generacion automatica de reportes periodicos (diarios, semanales, mensuales) que se envien por email? | |
| 47 | Los reportes deben incluir datos de alarmas, control de bombas, o solo telemetria? | |
| 48 | Hay reportes regulatorios que CONAGUA debe entregar a otra dependencia (CNA, SEMARNAT)? Cual es su formato? | |

---

## 7. INGESTA DE DATOS — Variables faltantes

*El GANTT espera recibir Gasto, Presion, Niveles, Lluvia y Estados operativos. Actualmente solo recibimos Gasto, Presion, Senal carrier, Estado de bomba, Estado de senales. Faltan Niveles y Lluvia.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 49 | **Datos de lluvia:** De donde vienen? Hay pluviometros instalados en los sitios? Son sensores LoRaWAN o datos de estaciones meteorologicas externas (SMN/CONAGUA)? | |
| 50 | **Datos de niveles:** Niveles de que? Nivel freatico del pozo? Nivel de tanque/cisterna? Hay sensores de nivel instalados? En cuantos sitios? | |
| 51 | El GANTT menciona "Almacenamiento historico (Nube y Servidores CONAGUA)" — CONAGUA tiene servidores propios donde debamos replicar datos? Es en adicion a nuestra nube? | |
| 52 | "Migracion de informacion" — hay datos historicos en otro sistema que debamos migrar? De que sistema? Que formato? Que rango de fechas? | |
| 53 | Actualmente ingesta cada 5 minutos. El GANTT dice cada 15 minutos. Cual es la frecuencia requerida? | |

---

## 8. VISUALIZACION — Render de sitios

*El render de sitios esta al 2% (solo 5 pozos). Necesitamos entender la expectativa.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 54 | "Digitalizar fotografia del sitio en un render" — que significa exactamente? Es un diagrama 2D esquematico del pozo basado en una foto real? Es un modelo 3D? Es una foto anotada? Necesitamos ejemplo visual. **(CRITICO)** | |
| 55 | Cuantos pozos necesitan render? Todos los ~46? O solo un subconjunto? | |
| 56 | Quien proporciona las fotografias de los sitios? Ya estan tomadas? En que formato? | |
| 57 | "Estado de bomba (Pendiente ajuste)" — que ajuste falta? Es un problema de datos o de visualizacion? | |

---

## 9. CONTROL REMOTO — Bitacora y permisos (50% completado)

*Encendido/apagado y cambio de estado funcionan. Falta bitacora de cambios y permisos.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 58 | Ademas de START/STOP bomba, hay otros comandos de control que se necesiten? (cambio de velocidad, apertura de valvulas, etc.) | |
| 59 | "Bitacora de cambios" — que datos registrar? (quien, cuando, que comando, resultado, desde que IP?) Nosotros ya tenemos audit_logs. Es suficiente o se necesita algo adicional? | |
| 60 | "Permisos" — solo el rol Operador puede controlar bombas? O tambien el Administrador? El rol Consulta/directivos puede ver la bitacora pero no operar? | |
| 61 | Se necesita programar horarios de encendido/apagado automatico de bombas? | |
| 62 | Se requiere logica de interlocks? (ej: no arrancar si presion > X, o si ya hay 3 bombas activas en el municipio) | |
| 63 | Se necesita confirmacion dual (two-man rule) para comandos criticos? | |

---

## 10. DICCIONARIOS — Especificacion (0% avance, deadline 29 abril)

*Modulo completamente sin avance. Necesitamos definicion clara.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 64 | "Explorador de variables desde BD" — es un panel donde el usuario selecciona una variable (ej: presion_pozo_23) y ve los datos crudos en tabla? Similar a un query builder? | |
| 65 | "Clasificacion por categoria (sitio, municipio, infraestructura)" — es un arbol jerarquico navegable? Ya tenemos entidades jerarquicas (Federal > Estatal > Municipal). Es eso o algo diferente? | |
| 66 | "Diccionario de variables con nomenclaturas y descripcion tecnica" — es una tabla de referencia (nombre variable, unidad, rango, descripcion)? Quien la llena? CONAGUA proporciona el catalogo inicial? | |

---

## 11. ANALITICAS, ML Y GEMELO DIGITAL — Alcance realista (0% avance, deadline 29 abril)

*Estos tres estan agrupados en un solo modulo en el GANTT. 0% avance y 2 meses para implementar redes neuronales + gemelo digital es ambicioso.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 67 | "Procesamiento de datos con redes neuronales, deteccion de anomalias, tendencias, predicciones y pronosticos" — todo esto es requerimiento contractual para abril? O es una vision a futuro? **(CRITICO)** | |
| 68 | Si es requerimiento contractual: hay datos historicos suficientes para entrenar modelos? Desde cuando se tienen datos? Cuantos meses/anos? | |
| 69 | Que tipo de anomalias se quieren detectar? (consumo inusual, fuga, robo de agua, sensor descompuesto, otro?) | |
| 70 | "Alertas predictivas — Panel de alertamiento" — es un dashboard aparte? O se integra al modulo de alarmas existente? | |
| 71 | "Gemelo Digital — Modelos Numericos" — que nivel de fidelidad se espera? Un modelo hidraulico simulable (tipo EPANET)? O una representacion visual del sistema? | |
| 72 | Hay modelos hidraulicos existentes del sistema que podamos reutilizar? (archivos EPANET, WaterGEMS, etc.) | |
| 73 | Quien interpretara los resultados de ML? Hay personal de ciencia de datos en CONAGUA? | |

---

## 12. INTEGRACIONES — Plataformas especificas (0% avance, deadline 29 abril)

*El GANTT menciona 5 integraciones concretas. Necesitamos acceso y documentacion de cada una.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 74 | **APIs ICH:** "Intercambio controlado de datos" — que es ICH en este contexto? Es un sistema existente de CONAGUA? Tienen API documentada? Necesitamos URL, credenciales, documentacion. **(CRITICO)** | |
| 75 | **Neptuno:** "Plataforma de incidentes — Integrar bases de datos GIS" — que es Neptuno? Es una plataforma interna de CONAGUA? Que datos debemos enviar/recibir? Tiene API? | |
| 76 | **Neza Crece:** "Plataforma de incidentes — Integrar bases de datos GIS" — igual que Neptuno. Que es? API? Formato de datos? Es solo para el municipio de Neza? | |
| 77 | **Nuevas variables por municipio:** "Integrar base de datos de variables" — cada municipio tiene su propio plan de crecimiento de sensores? Hay un documento que liste las variables futuras? | |
| 78 | **Otros sistemas institucionales:** Cuales son? Tienen APIs? Son de solo lectura o bidireccionales? | |
| 79 | Hay integracion con CFE (Comision Federal de Electricidad) para datos de consumo energetico? | |

---

## 13. SEGURIDAD Y HOSTING — Responder HOY

*El GANTT menciona "Terminar configuracion de OCI" en el modulo de control de acceso (90% avance). Necesitamos definir infraestructura.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 80 | "Terminar configuracion de OCI" — que falta configurar en Oracle Cloud? Red, firewall, DNS, certificados SSL, otro? **(CRITICO)** | |
| 81 | La produccion corre en OCI. Tenemos acceso al tenant? Credenciales? Quien administra la cuenta OCI? | |
| 82 | Se requiere ambiente de staging/QA separado de produccion en OCI? | |
| 83 | Que normas de seguridad informatica aplican? (MAAGTICSI, ISO 27001, NMX-I-27001?) | |
| 84 | La autenticacion 2FA ya funciona (email + Google Authenticator). Es obligatoria para TODOS los roles o solo para Administrador? | |
| 85 | Se requiere integracion con Active Directory / LDAP de CONAGUA? | |
| 86 | Hay politica de complejidad/rotacion de contrasenas de CONAGUA? | |
| 87 | Se requiere cierre de sesion automatico por inactividad? Despues de cuanto tiempo? (actualmente 8 horas de JWT) | |
| 88 | Se requiere WAF, DDoS protection, cifrado at rest? O con TLS/HTTPS es suficiente? | |
| 89 | El sistema sera auditado por un tercero (pentest)? Cuando? | |
| 90 | CONAGUA tiene CISO o equipo de ciberseguridad con el que debamos coordinarnos? | |

---

## 14. USUARIOS AVANZADOS Y GRAFICAS — Especificacion (0% avance, deadline 29 abril)

*El modulo 8 del GANTT se llama "Usuarios" pero trata sobre graficas avanzadas y vistas personalizadas.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 91 | "Guardado de graficos, edicion y almacenamiento" — el usuario puede guardar sus propias graficas personalizadas? (ej: "mi grafica de presion del pozo 23 con rango de 30 dias") | |
| 92 | "Vistas por usuarios" — cada usuario puede tener un dashboard personalizado? O es por rol? | |
| 93 | Esto se relaciona con el modulo de sinopticos? Un sinoptico ES una vista personalizada? O son cosas separadas? | |

---

## 15. INFRAESTRUCTURA FISICA E IoT

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 94 | Cuantos pozos/estaciones se monitorearan en total? (actualmente ~46) Se planea agregar mas? Cuantos en los proximos 6 meses? | |
| 95 | Cuales son TODOS los municipios en el alcance? (actualmente: Ecatepec, Chalco, Chicoloapan, Tlalnepantla, Valle de Chalco, La Paz) Faltan? | |
| 96 | Solo Estado de Mexico o se expandira a otros estados? | |
| 97 | Hay estaciones que monitoreen algo diferente a pozos? (tanques, potabilizadoras, presas, carcamos) | |
| 98 | Necesitamos el listado completo de sitios con coordenadas GPS y tipo de equipo instalado. Quien lo tiene? | |
| 99 | Cuantos gateways LoRaWAN hay? Donde? Que modelo? Hay zonas sin cobertura? | |
| 100 | Dispositivos Ignition/ICH — cuantos son y en que sitios? Se mantiene dual (ChirpStack + Ignition) o se migrara? | |
| 101 | Se pueden actualizar firmwares de dispositivos remotamente (FUOTA)? | |

---

## 16. DATOS Y MIGRACION

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 102 | El GANTT menciona "Definir migracion" como pendiente. Hay datos historicos en otro sistema? De que sistema? Que formato? | |
| 103 | Los datos actuales estan en http://loranet.playtelecom.com:8080. Todo se migra a OCI? Timeline? | |
| 104 | Politica de retencion de datos: cuanto tiempo se guardan datos crudos? Hay requisito legal? | |
| 105 | Se necesita backup en ubicacion geografica diferente? | |

---

## 17. PROCESO Y SCRUM — Responder HOY

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 106 | Cual es la duracion del sprint? | |
| 107 | Que herramienta se usa para gestionar el backlog? (el GANTT en Excel es la unica fuente?) | |
| 108 | Con que frecuencia hay demos/revisiones con CONAGUA? | |
| 109 | Hay un Product Owner designado por CONAGUA? Quien es? | |
| 110 | El GANTT lo actualiza quien? Cada cuanto? | |
| 111 | Cual es el canal de comunicacion principal? (Slack, Teams, WhatsApp, email?) | |
| 112 | Quienes conforman el equipo completo? Solo PlayTelecom o hay otros proveedores en paralelo? | |
| 113 | El equipo "Dev" que se menciona en el GANTT (columna H) — somos nosotros? Alguien mas contribuye codigo? | |
| 114 | Quien valida los criterios de aceptacion de cada modulo? | |
| 115 | Hay ambiente de UAT donde CONAGUA prueba antes de aceptar? | |

---

## 18. EXPERIENCIA DE USUARIO Y SOPORTE

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 116 | Que dispositivos usan los usuarios? (desktop, tablet, celular?) Se necesita app movil nativa o responsive basta? | |
| 117 | Se necesita funcionalidad offline para tecnicos en campo? | |
| 118 | Hay lineamientos de identidad grafica de CONAGUA que debamos seguir? (colores, logo, tipografia) | |
| 119 | Se necesita manual de usuario? Impreso o digital? Para cuantas personas? | |
| 120 | Cual es el modelo de soporte post-entrega? (24/7, horario laboral) | |
| 121 | Se necesita mesa de ayuda / helpdesk? | |

---

## 19. PROACTIVAS — Propuestas de valor agregado

*Preguntas que demuestran vision tecnica y agregan valor al proyecto.*

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 122 | Para las alarmas WhatsApp — han considerado tambien push notifications via PWA (Progressive Web App)? Es mas barato que WhatsApp Business API y no depende de proveedor externo. | |
| 123 | Para el gemelo digital — han evaluado modelos EPANET (open source) vs WaterGEMS (licencia)? | |
| 124 | Han considerado optimizar horarios de bombeo basado en tarifas electricas de CFE (peak vs off-peak)? Podria ahorrar significativamente. | |
| 125 | Para sinopticos — han evaluado un editor basado en web tipo draw.io/excalidraw con componentes SCADA predefinidos? O prefieren un approach mas simple? | |
| 126 | Han considerado edge computing para los sitios sin buena conectividad? Procesamiento local + sincronizacion cuando hay senal. | |
| 127 | Si el proyecto escala a nivel nacional — han evaluado arquitectura multi-tenant? | |
| 128 | Para reportes regulatorios — se requiere conformidad con NOM-012-CONAGUA (medicion de agua)? | |

---

## 20. DOCUMENTOS QUE NECESITAMOS RECIBIR

Checklist ordenada por urgencia:

**HOY:**
- [ ] TDR / Statement of Work completo (PDF)
- [ ] Matriz de permisos por rol aprobada (la oficial, no la del GANTT)
- [ ] Credenciales de OCI (Oracle Cloud) si no las tenemos
- [ ] Shapefiles/capas GIS faltantes (el modulo vence manana)

**ESTA SEMANA:**
- [ ] Catalogo de alarmas con umbrales por variable y por sitio
- [ ] Mockup o ejemplo visual de como debe verse un sinoptico
- [ ] Fotografias de los pozos para los renders (modulo Visualizacion)
- [ ] Documentacion de APIs: Neptuno, Neza Crece, ICH
- [ ] Formato de "reporte base de operacion" actual (el que usan en papel/Excel)
- [ ] Listado completo de sitios con coordenadas y equipos instalados
- [ ] Especificaciones de sensores de lluvia y niveles (variables faltantes)

**PROXIMAS 2 SEMANAS:**
- [ ] Modelos hidraulicos existentes (EPANET, WaterGEMS) si existen
- [ ] Diccionario de variables (nomenclaturas, rangos, unidades)
- [ ] Datos historicos para migracion (formato, rango de fechas)
- [ ] Politicas de seguridad informatica de CONAGUA
- [ ] Organigrama de CONAGUA relevante al proyecto
- [ ] Acuerdos de nivel de servicio (SLA) requeridos

---

## Resumen de Prioridades

### HOY (bloquean desarrollo)
- Preguntas 11-19: Roles y permisos (discrepancia critica)
- Preguntas 28-33: GIS (vence manana)
- Preguntas 80-90: Seguridad y hosting (config OCI)
- Preguntas 106-115: Proceso Scrum

### ESTA SEMANA (modulos con 0% avance)
- Preguntas 1-10: Contrato y alcance
- Preguntas 20-27: Sinopticos (modulo mas atrasado)
- Preguntas 34-42: Alarmas
- Preguntas 43-48: Reportes
- Preguntas 49-53: Variables faltantes (lluvia, niveles)
- Preguntas 74-79: Integraciones (Neptuno, Neza Crece, ICH)

### PROXIMAS 2 SEMANAS
- Preguntas 54-57: Visualizacion/renders
- Preguntas 64-66: Diccionarios
- Preguntas 67-73: Analiticas/ML/Gemelo Digital
- Preguntas 91-93: Graficas avanzadas
- Preguntas 94-105: Infraestructura y datos

---

*Documento basado en GANTT v4 (15 enero 2026) — Actualizado 26 febrero 2026 — Equipo Tecnico PlayTelecom*
