// src/server.ts

import 'dotenv/config';
import app from './app';

// Fail fast: variables de entorno críticas requeridas
const REQUIRED_ENV = ['JWT_SECRET', 'PG_HOST', 'PG_USER', 'PG_PASSWORD', 'PG_DATABASE', 'INFLUX_TOKEN'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
    console.error(`❌ [SCADA] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

const PORT: number = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, (): void => {
  console.log(`⚡️ [SCADA Query API]: Server running on port ${PORT}`);
});
