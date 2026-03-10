export const POZOS_DATA: Record<string, any> = {
  // Pozo local para desarrollo
  'pozo-demo-local': {
    devEui: 'POZO-DEV-LOCAL-001',
    nombre: 'Pozo Demo Local',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Entorno de desarrollo local',
    lte: { rssi: -75, snr: 8 },
    lat: 19.4326,
    lng: -99.1332,
    tipo: 'LoRaWAN',
    estatus: 'Activo',
    proveedor: 'DEV'
  },

  // Sitios pilotos
  'sitio-piloto-4pt': {
    devEui:'24e124445e281836',
    nombre: 'Sitio Piloto 4PT',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Sitio piloto en operación',
    lte: { rssi: -0, snr: 0 },
    lat: 19.345535278320312,
    lng: -99.31107330322266,
    tipo: 'Piloto',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'sitio-piloto-ich': {
    devEui:'dev_ich_0000001',
    nombre: 'POZO XYZ Piloto ICH',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Sitio piloto en operación',
    lte: { rssi: -0, snr: 0 },
    lat: 18.9510067,
    lng: -99.2410269,
    tipo: 'Piloto',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

 // SITIOS ECATEPEC
  'pozo-9-guaymas': {
    devEui:'24e124445e280359',
    nombre: 'Pozo 009 - Guaymas',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Variación de presión detectada',
    lte: { rssi: -0, snr: 0 },
    lat: 19.54717445373535,
    lng: -99.0495376586914,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: '4PT'
  },

   'pozo-izcalli-jardines': {
    devEui:'24e124445e280359',
    nombre: 'Pozo Izcalli Jardines',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Variación de presión detectada',
    lte: { rssi: -0, snr: 0 },
    lat: 19.607869,
    lng: -99.023383,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: '4PT'
  },



  'pozo-334-jardines-de-casa-nueva-1': {
    devEui:'24e124445e280517',
    nombre: 'Pozo 334 – Jardines de Casa Nueva I',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Flujo estable',
    lte: { rssi: -0, snr: 0 },
    lat: 19.55242347717285,
    lng: -99.04556274414062,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },
  
  'pozo-354-ecatepec-2': {
    devEui:'24e124445e281542',  
    nombre: 'Pozo 354 – Ecatepec 2',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Consumo elevado detectado',
    lte: { rssi: -0, snr: 0 },
    lat: 19.537694931030273,
    lng: -99.04466247558594,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-342-san-martin-de-porres': {
    devEui:'24e124445e281769',
    nombre: 'Pozo 342 -San Martín de Porres',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Sitio funcionando con normalidad',
    lte: { rssi: -0, snr: 0 },
    lat: 19.601831436157227,
    lng: -99.02698516845703,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-318-calle-35': {
    devEui:'24e124445e280416',
    nombre: 'Pozo 318 – Calle 35',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -0, snr: 0 },
    lat: 19.54646110534668,
    lng: -99.03580474853516,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },
  
  'pozo-21-la-veleta': {
    devEui:'24e124445e281357',
    nombre: 'Pozo 21 - La Veleta',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -0, snr: 0 },
    lat: 19.55242347717285,
    lng: -99.04556274414062,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-346-carmen-serdan': {
    devEui:'24e124445e281620',
    nombre: 'Pozo 346 Carmen Serdán',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -0, snr: 0 },
    lat: 19.603008,
    lng: -99.019844,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-338-calle-nieve': {
    devEui:'24e124445e281604',
    nombre: 'Pozo 338 - Calle Nieve',
    nivel: 0,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -0, snr: 0 },
    lat: 19.596277,
    lng: -98.995112,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-314-llano-de-morelos': {
    devEui:'24e124445e281717',
    nombre: 'Pozo 314 Llano de Morelos',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.610309,
    lng: -99.008249,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-1-salesianos': {
    devEui:'24e124445e281568',
    nombre: 'Pozo 1 Salesianos',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.60517,
    lng: -99.04128,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-30-lazaro-cardenas': {
    devEui:'24e124445e280461',
    nombre: 'Pozo 30 Lázaro Cárdenas',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.6138889,
    lng: -98.983888,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-348-rio-de-luz': {
    devEui:'24e124445e282251',
    nombre: 'Pozo 348 Río de Luz',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.55315,
    lng: -99.029039,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-322-chiconautla': {
    devEui:'24e124445e280381',
    nombre: 'Pozo 322 Chiconautla',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.643376,
    lng: -99.000807,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-abel-martinez-montanez': {
    devEui:'24e124445e281715',
    nombre: 'Pozo 61 Abel Martínez Montañez',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.640049,
    lng: -99.054719,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: '4PT'
  },
  
  'pozo-324-fovissste': {
    devEui:'24E124445E281263',
    nombre: 'Pozo 324 Fovissste',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.6155556,
    lng: -99.078611,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: '4PT'
  },

// SITIOS CHALCO

  'pozo-ayotzingo': {
    devEui:'24e124445e282370',
    nombre: 'Pozo Ayotzingo',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.215462,
    lng: -98.92241,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-12-caserio': {
    devEui:'24e124445e280608',
    nombre: 'Pozo 12 Caserio',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.207033,
    lng: -98.948233,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-10-chalco': {
    devEui:'',
    nombre: 'Pozo 10 Chalco',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.286942,
    lng: -98.908793,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: '4PT'
  },

  'pozo-11-chalco': {
    devEui:'',
    nombre: 'Pozo 11 Chalco',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.259551,
    lng: -98.909936,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: '4PT'
  },

  'pozo-xico-nuevo': {
    devEui:'24e124445e282287',
    nombre: 'Pozo Xico Nuevo',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.236331,
    lng: -98.911838,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: '4PT'
  },

   'pozo-13-chimalpa-2': {
    devEui:'24e124445e281263',
    nombre: 'Pozo 13 Chimalpa 2',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.236883,
    lng: -98.918762,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: '4PT'
  },

  'pozo-hacienda-guadalupe': {
    devEui:'24e124445e215003',
    nombre: 'Pozo Hacienda Guadalupe',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.247971,
    lng: -98.842691,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: '4PT'
  },

  'pozo-hacienda-san-juan': {
    devEui:'24e124445e218731',
    nombre: 'Pozo Hacienda San Juan',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.269502,
    lng: -98.839094,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: '4PT'
  },

  'pozo-14-ayotzingo-2': {
    devEui:'',
    nombre: 'Pozo 14 Ayotzingo 2',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.208295,
    lng: -98.940989,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: '4PT'
  },

  'pozo-8-chalco': {
    devEui:'',
    nombre: 'Pozo 8 Chalco',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.281159,
    lng: -98.88789,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: '4PT'
  },

// SITIOS IXTAPALUCA

  'pozo-1-ixtapaluca': {
    devEui:'dev0000000000001',
    nombre: 'Pozo 01 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.31724907803589,
    lng: -98.84823069606689,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

  'pozo-5-ixtapaluca': {
    devEui:'dev0000000000005',
    nombre: 'Pozo 05 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.32239305731164,
    lng: -98.88946433949809,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: 'ICH'
  },

  'pozo-12-ixtapaluca': {
    devEui:'dev0000000000012',
    nombre: 'Pozo 12 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.29319647772695,
    lng: -98.90813666519421,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

   'pozo-13-ixtapaluca': {
    devEui:'dev0000000000013',
    nombre: 'Pozo 13 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.29541837527117,
    lng: -98.88645390334638,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: 'ICH'
  },

  'pozo-16-ixtapaluca': {
    devEui:'dev0000000000016',
    nombre: 'Pozo 16 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.33432577592962,
    lng: -98.94470506895368,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

  'pozo-21-ixtapaluca': {
    devEui:'dev0000000000021',
    nombre: 'Pozo 21 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.32364785186973,
    lng: -98.87981993461943,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

   'pozo-24-ixtapaluca': {
    devEui:'dev0000000000024',
    nombre: 'Pozo 24 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.31235238346356,
    lng: -98.89848005371785,
    tipo: 'Pozo',
    estatus: 'Obra',
    proveedor: 'ICH'
  },

  'pozo-25-ixtapaluca': {
    devEui:'dev0000000000025',
    nombre: 'Pozo 25 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.31115377502013,
    lng: -98.88832707862549,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

   'pozo-30-ixtapaluca': {
    devEui:'dev0000000000030',
    nombre: 'Pozo 30 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.30509519080447,
    lng: -98.86636257998913,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

   'pozo-32-ixtapaluca': {
    devEui:'dev0000000000032',
    nombre: 'Pozo 32 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.30582620623062,
    lng: -98.8573541743884,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

  'pozo-34-ixtapaluca': {
    devEui:'dev0000000000034',
    nombre: 'Pozo 34 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.30266751919307,
    lng: -98.89829368667948,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH' 
  },
  
  'pozo-35-ixtapaluca': {
    devEui:'dev0000000000035',
    nombre: 'Pozo 35 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.2963312411926,
    lng: -98.89162771063241,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

  'pozo-36-ixtapaluca': {
    devEui:'dev0000000000036',
    nombre: 'Pozo 36 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.30870385803725,
    lng: -98.89395572551975,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

   'pozo-37-ixtapaluca': {
    devEui:'dev0000000000037',
    nombre: 'Pozo 37 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.32754948705784,
    lng: -98.88349174269203,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

   'pozo-39-ixtapaluca': {
    devEui:'dev0000000000039',
    nombre: 'Pozo 39 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.31496129970301,
    lng: -98.91080119927668,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

  'pozo-40-ixtapaluca': {
    devEui:'dev0000000000040',
    nombre: 'Pozo 40 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.35279636430159,
    lng: -98.85087906411255,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

  'pozo-42-ixtapaluca': {
    devEui:'dev0000000000042',
    nombre: 'Pozo 42 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.31815063300321,
    lng: -98.8992275054901,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

  'pozo-44-ixtapaluca': {
    devEui:'dev0000000000044',
    nombre: 'Pozo 44 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.32525952382917,
    lng: -98.93206456373802,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

  'pozo-49-ixtapaluca': {
    devEui:'dev0000000000049',
    nombre: 'Pozo 49 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.33631030551746,
    lng: -98.87220025177389,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

  'pozo-50-ixtapaluca': {
    devEui:'dev0000000000050',
    nombre: 'Pozo 50 Ixtapaluca',
    nivel: 51,
    caudal: 0,
    presion: 0,
    alerta: 'Monitoreo preventivo activo',
    lte: { rssi: -15, snr: 16.9 },
    lat: 19.28941510630607,
    lng: -98.84606746023525,
    tipo: 'Pozo',
    estatus: 'Activo',
    proveedor: 'ICH'
  },

};

// Municipality ID assignments (CVE_MUN from INEGI)
// Ecatepec = 33, Chalco = 25, Ixtapaluca = 39
const ECATEPEC = 33;
const CHALCO = 25;
const IXTAPALUCA = 39;

const municipioAssignments: Record<string, number> = {
  // Ecatepec
  'pozo-9-guaymas': ECATEPEC,
  'pozo-izcalli-jardines': ECATEPEC,
  'pozo-334-jardines-de-casa-nueva-1': ECATEPEC,
  'pozo-354-ecatepec-2': ECATEPEC,
  'pozo-342-san-martin-de-porres': ECATEPEC,
  'pozo-318-calle-35': ECATEPEC,
  'pozo-21-la-veleta': ECATEPEC,
  'pozo-346-carmen-serdan': ECATEPEC,
  'pozo-338-calle-nieve': ECATEPEC,
  'pozo-314-llano-de-morelos': ECATEPEC,
  'pozo-1-salesianos': ECATEPEC,
  'pozo-30-lazaro-cardenas': ECATEPEC,
  'pozo-348-rio-de-luz': ECATEPEC,
  'pozo-322-chiconautla': ECATEPEC,
  'pozo-abel-martinez-montanez': ECATEPEC,
  'pozo-324-fovissste': ECATEPEC,
  // Chalco
  'pozo-ayotzingo': CHALCO,
  'pozo-12-caserio': CHALCO,
  'pozo-10-chalco': CHALCO,
  'pozo-11-chalco': CHALCO,
  'pozo-xico-nuevo': CHALCO,
  'pozo-13-chimalpa-2': CHALCO,
  'pozo-hacienda-guadalupe': CHALCO,
  'pozo-hacienda-san-juan': CHALCO,
  'pozo-14-ayotzingo-2': CHALCO,
  'pozo-8-chalco': CHALCO,
  // Ixtapaluca
  'pozo-1-ixtapaluca': IXTAPALUCA,
  'pozo-5-ixtapaluca': IXTAPALUCA,
  'pozo-12-ixtapaluca': IXTAPALUCA,
  'pozo-13-ixtapaluca': IXTAPALUCA,
  'pozo-16-ixtapaluca': IXTAPALUCA,
  'pozo-21-ixtapaluca': IXTAPALUCA,
  'pozo-24-ixtapaluca': IXTAPALUCA,
  'pozo-25-ixtapaluca': IXTAPALUCA,
  'pozo-30-ixtapaluca': IXTAPALUCA,
  'pozo-32-ixtapaluca': IXTAPALUCA,
  'pozo-34-ixtapaluca': IXTAPALUCA,
  'pozo-35-ixtapaluca': IXTAPALUCA,
  'pozo-36-ixtapaluca': IXTAPALUCA,
  'pozo-37-ixtapaluca': IXTAPALUCA,
  'pozo-39-ixtapaluca': IXTAPALUCA,
  'pozo-40-ixtapaluca': IXTAPALUCA,
  'pozo-42-ixtapaluca': IXTAPALUCA,
  'pozo-44-ixtapaluca': IXTAPALUCA,
  'pozo-49-ixtapaluca': IXTAPALUCA,
  'pozo-50-ixtapaluca': IXTAPALUCA,
};

// Merge municipioId into each pozo object
Object.entries(municipioAssignments).forEach(([key, municipioId]) => {
  if (POZOS_DATA[key]) POZOS_DATA[key].municipioId = municipioId;
});

