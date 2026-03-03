// src/server.ts (Versión actualizada)

import 'dotenv/config';
import app from './app'; // Importa la aplicación Express desde app.ts
import './ingestion-client'; // Importa el cliente MQTT para iniciarlo (efecto side effect)

// Definición estricta de variables de configuración
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Inicio del Servidor Express
app.listen(PORT, (): void => {
  console.log(`⚡️ [Server]: API running on port ${PORT}`);
  console.log(`📡 [Ingestion]: MQTT Client should be connecting to ${process.env.MQTT_HOST}:${process.env.MQTT_PORT}...`);
});
