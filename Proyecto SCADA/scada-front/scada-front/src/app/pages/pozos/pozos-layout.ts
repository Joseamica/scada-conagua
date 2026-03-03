export const POZOS_LAYOUT: Record<string, any> = {
  // Layout para desarrollo local
  'pozo-demo-local': {
    render: 'pozo-guaymas.png',
    overlays: {
      nivel:   { x: 40,   y: 220 },
      presion: { x: 33,   y: 32  },
      caudal:  { x: 52.5, y: 19  },
      lteBox:  { x: 87,   y: 20  }
    }
  },

  'pozo-9-guaymas': {
    render: 'pozo-guaymas.png',
    overlays: {
      nivel:  { x: 40,  y: 220 },
      presion: { x: 33, y: 32 }, // porcentajes
      caudal: { x: 52.5, y: 19 }, // porcentajes
      lteBox: { x: 87,  y: 20  }
    }
  },

  'pozo-izcalli-jardines': {
    render: 'pozo-izcalli-jardines.png',
    overlays: {
      nivel:  { x: 40,  y: 220 },
      presion: { x: 33, y: 32 }, // porcentajes
      caudal: { x: 52.5, y: 19 }, // porcentajes
      lteBox: { x: 87,  y: 20  }
    }
  },

  'pozo-334-jardines-de-casa-nueva-1': {
    render: 'pozo-334-jardin-nueva.png',
    overlays: {
      nivel:  { x: 55,  y: 200 },
      presion: { x:36, y: 42 }, // porcentajes
      caudal: { x: 57, y: 26 }, // porcentajes
      lteBox: { x: 20,  y: 12  }
    }
  },

  'pozo-354-ecatepec-2': {
    render: 'pozo-354-ecatepec-2.png',
    overlays: {
      nivel:  { x: 100,  y: 190 },
      presion: { x: 69.5, y: 48 }, // porcentajes
      caudal: { x: 49.3, y: 38 }, // porcentajes
      lteBox: { x: 75.8,  y: 21.5  }
    }
  },

  'sitio-piloto-4pt': {
    render: 'pozo-354-ecatepec-2.png',
    overlays: {
      nivel:  { x: 100,  y: 190 },
      presion: { x: 65.5, y: 48 }, // porcentajes
      caudal: { x: 49.3, y: 38 }, // porcentajes
      lteBox: { x: 76.8,  y: 19.5  }
    }
  },

  'sitio-piloto-ich': {
    render: 'pozo-354-ecatepec-2.png',
    overlays: {
      nivel:  { x: 100,  y: 190 },
      presion: { x: 65.5, y: 48 }, // porcentajes
      caudal: { x: 49.3, y: 38 }, // porcentajes
      lteBox: { x: 76.8,  y: 19.5  }
    }
  },

  'pozo-342-san-martin-de-porres': {
    render: 'pozo-san-martin-porres.png',
    overlays: {
      nivel:  { x: 50,  y: 210 },
      presion: { x: 19, y: 46 }, // porcentajes
      caudal: { x: 40, y: 35 }, // porcentajes
      lteBox: { x: 90,  y: 19  }
    }
  },

  'pozo-318-calle-35': {
    render: 'pozo-318-calle-35.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 81, y: 58 }, // porcentajes
      caudal: { x: 63.5, y: 44 }, // porcentajes
      lteBox: { x: 84,  y: 21  }
    }
  },

  'pozo-21-la-veleta': {
    render: 'pozo-la-veleta.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 42, y: 48 }, // porcentajes
      caudal: { x: 67.5, y: 35 }, // porcentajes
      lteBox: { x: 25,  y: 11  }
    }
  },

  'pozo-346-carmen-serdan': {
    render: 'pozo-346-carmen-serdan.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 86, y: 38 }, // porcentajes
      caudal: { x: 67.5, y: 26 }, // porcentajes
      lteBox: { x: 87,  y: 11  }
    }
  },

  'pozo-338-calle-nieve': {
    render: 'pozo-338-calle-nieve.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 18, y: 36 }, // porcentajes
      caudal: { x: 38.5, y: 24 }, // porcentajes
      lteBox: { x: 10,  y: 21  }
    }
  },

  'pozo-314-llano-de-morelos': {
    render: 'pozo-314-llano-de-morelos.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 65, y: 28 }, // porcentajes
      caudal: { x: 46.2, y: 17 }, // porcentajes
      lteBox: { x: 89,  y: 18  }
    }
  },

  'pozo-1-salesianos': {
    render: 'pozo-salesianos.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 29, y: 30 }, // porcentajes
      caudal: { x: 49, y: 15 }, // porcentajes
      lteBox: { x: 12,  y: 18  }
    }
  },

  'pozo-30-lazaro-cardenas': {
    render: 'pozo-30-lazaro-cardenas.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 75, y: 45 }, // porcentajes
      caudal: { x: 53.1, y: 34 }, // porcentajes
      lteBox: { x: 89,  y: 18  }
    }
  },

  'pozo-348-rio-de-luz': {
    render: 'pozo-348-rio-de-luz.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 9.5, y: 61 }, // porcentajes
      caudal: { x: 33.2, y: 49 }, // porcentajes
      lteBox: { x: 36,  y: 18  }
    }
  },

  'pozo-322-chiconautla': {
    render: 'pozo-322-chiconautla.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 29, y: 53 }, // porcentajes
      caudal: { x: 53.1, y: 42 }, // porcentajes
      lteBox: { x: 56,  y: 18  }
    }
  },

  'pozo-abel-martinez-montanez': {
    render: 'pozo-61-abel-martin.jpg',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 51, y: 40 }, // porcentajes
      caudal: { x: 72, y: 28 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-324-fovissste': {
    render: 'pozo-324-fovisste.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 34.5, y: 27 }, // porcentajes
      caudal: { x: 55.2, y: 15 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-ayotzingo': {
    render: 'pozo-ayotzingo.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 22.5, y: 38 }, // porcentajes
      caudal: { x: 45.2, y: 28 }, // porcentajes
      lteBox: { x: 12,  y: 20  }
    }
  },

  'pozo-12-caserio': {
    render: 'pozo-12-caserio.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 9.5, y: 35 }, // porcentajes
      caudal: { x: 29, y: 21 }, // porcentajes
      lteBox: { x: 85,  y: 18  }
    }
  },

  'pozo-10-chalco': {
    render: 'pozo-10-chalco.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 25, y: 41 }, // porcentajes
      caudal: { x: 46.2, y: 26 }, // porcentajes
      lteBox: { x: 14,  y: 22  }
    }
  },

   'pozo-11-chalco': {
    render: 'pozo-11-chalco.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 29, y: 32 }, // porcentajes
      caudal: { x: 52.4, y: 19 }, // porcentajes
      lteBox: { x: 85,  y: 22  }
    }
  },

  'pozo-xico-nuevo': {
    render: 'pozo-xico-nuevo.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 42, y: 38 }, // porcentajes
      caudal: { x: 64, y: 25 }, // porcentajes
      lteBox: { x: 89,  y: 18  }
    }
  },

  'pozo-13-chimalpa-2': {
    render: 'pozo-13-chimalpa-II.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 12.5, y: 46 }, // porcentajes
      caudal: { x: 32.2, y: 29 }, // porcentajes
      lteBox: { x: 13,  y: 20  }
    }
  },

  'pozo-hacienda-guadalupe': {
    render: 'pozo-hacienda-guadalupe.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 62, y: 35 }, // porcentajes
      caudal: { x: 43.4, y: 22 }, // porcentajes
      lteBox: { x: 80,  y: 22  }
    }
  },

  'pozo-hacienda-san-juan': {
    render: 'pozo-hacienda-san-juan.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 8.5, y: 37 }, // porcentajes
      caudal: { x: 32.2, y: 21 }, // porcentajes
      lteBox: { x: 55,  y: 22  }
    }
  },

  'pozo-14-ayotzingo-2': {
    render: 'pozo-14-ayotzingo-II.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 42.5, y: 35 }, // porcentajes
      caudal: { x: 65.2, y: 22 }, // porcentajes
      lteBox: { x: 86,  y: 19  }
    }
  },

   'pozo-8-chalco': {
    render: 'pozo-8-chalco.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 38.5, y: 35 }, // porcentajes
      caudal: { x: 60.2, y: 24 }, // porcentajes
      lteBox: { x: 29,  y: 22  }
    }
  },

// SITIOS IXTAPALUCA

  'pozo-1-ixtapaluca': {
    render: 'pozo-1-ixtapaluca.png',
    overlays: {
      nivel:  { x: 12, y: 70 },
      presion: { x: 18, y: 22 },
      caudal:  { x: 52, y: 18 },
      lteBox:  { x: 85, y: 15 }
    }
  },

  'pozo-5-ixtapaluca': {
    render: 'pozo-5-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 74.5, y: 47 }, // porcentajes
      caudal: { x: 40.2, y: 24 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-12-ixtapaluca': {
    render: 'pozo-12-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 11.5, y: 24 }, // porcentajes
      caudal: { x: 37.2, y: 8 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-13-ixtapaluca': {
    render: 'pozo-13-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 64.5, y: 35 }, // porcentajes
      caudal: { x: 44.2, y: 15 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-16-ixtapaluca': {
    render: 'pozo-16-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 77.5, y: 29 }, // porcentajes
      caudal: { x: 49.2, y: 11 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-21-ixtapaluca': {
    render: 'pozo-21-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 26.5, y: 46 }, // porcentajes
      caudal: { x: 51.2, y: 34 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-24-ixtapaluca': {
    render: 'pozo-24-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 22, y: 30 }, // porcentajes
      caudal: { x: 53.2, y: 10 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-25-ixtapaluca': {
    render: 'pozo-25-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 22.5, y: 26 }, // porcentajes
      caudal: { x: 50.2, y: 8 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-30-ixtapaluca': {
    render: 'pozo-30-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 13.5, y: 32 }, // porcentajes
      caudal: { x: 38.2, y: 16 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-32-ixtapaluca': {
    render: 'pozo-32-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 73.5, y: 37 }, // porcentajes
      caudal: { x: 52.2, y: 24 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-34-ixtapaluca': {
    render: 'pozo-34-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 67.5, y: 33 }, // porcentajes
      caudal: { x: 49.2, y: 20 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-35-ixtapaluca': {
    render: 'pozo-35-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 47.5, y: 43 }, // porcentajes
      caudal: { x: 72.2, y: 32 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-36-ixtapaluca': {
    render: 'pozo-36-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 68.5, y: 20 }, // porcentajes
      caudal: { x: 37.2, y: 10 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-37-ixtapaluca': {
    render: 'pozo-37-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 16.5, y: 24 }, // porcentajes
      caudal: { x: 50.2, y: 22 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-39-ixtapaluca': {
    render: 'pozo-39-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 85.5, y: 47 }, // porcentajes
      caudal: { x: 76.2, y: 20 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-40-ixtapaluca': {
    render: 'pozo-40-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 20.5, y: 20 }, // porcentajes
      caudal: { x: 49.2, y: 15 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-42-ixtapaluca': {
    render: 'pozo-42-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 12.5, y: 37 }, // porcentajes
      caudal: { x: 57.2, y: 25 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-44-ixtapaluca': {
    render: 'pozo-44-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 81.5, y: 16 }, // porcentajes
      caudal: { x: 44.2, y: 22 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-49-ixtapaluca': {
    render: 'pozo-49-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 85.5, y: 53 }, // porcentajes
      caudal: { x: 71.2, y: 29 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

  'pozo-50-ixtapaluca': {
    render: 'pozo-50-ixtapaluca.png',
    overlays: {
      nivel:  { x: 48,  y: 215 },
      presion: { x: 9.5, y: 49 }, // porcentajes
      caudal: { x: 34.2, y: 36 }, // porcentajes
      lteBox: { x: 10,  y: 18  }
    }
  },

};
