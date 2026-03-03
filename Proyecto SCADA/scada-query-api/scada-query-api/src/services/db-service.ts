// src/services/db-service.ts
import { Pool } from 'pg';
import 'dotenv/config';

// Usamos los mismos nombres de variables que la Ingestion API para consistencia
export const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    user: process.env.PG_USER || 'scada_user',
    password: process.env.PG_PASSWORD || 'Sc@d42025$',
    database: process.env.PG_DATABASE || 'scada_metadata',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    max: 10, // Menos conexiones para lectura que para ingesta
    idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
    console.error('🛑 Query API - Postgres Pool Error:', err);
});
