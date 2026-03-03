// src/routes/telemetry.ts
import { Router } from 'express';
import { getSiteStatus, getSiteHistory } from '../app'; // Importaremos los handlers desde app.ts

const router = Router();

// Endpoint para el "Live Status" (Postgres)
router.get('/status/:dev_eui', getSiteStatus);

// Endpoint para el "Histórico" (InfluxDB)
router.get('/history/:dev_eui/:measurement', getSiteHistory);

export default router;
