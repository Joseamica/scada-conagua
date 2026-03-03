// src/app.ts

import express, { Application, Request, Response } from 'express';

// Crea la instancia de la aplicación Express
const app: Application = express();

// Middleware para parsear JSON
app.use(express.json());

// --- Ruta de Health Check / Status para este Microservicio de Ingesta ---
app.get('/', (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'SCADA Ingestion Microservice is RUNNING',
    description: 'Handles MQTT telemetry ingesta and API health checks.',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Exportamos la aplicación para que el server la inicie
export default app;
