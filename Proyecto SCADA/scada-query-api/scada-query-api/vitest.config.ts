import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        env: {
            NODE_ENV: 'test',
            JWT_SECRET: 'test_secret_scada_vitest',
            PG_HOST: 'localhost',
            PG_PORT: '5440',
            PG_USER: 'scada_user',
            PG_PASSWORD: 'test_password',
            PG_DATABASE: 'scada_metadata',
            INFLUX_URL: 'http://localhost:8086',
            INFLUX_TOKEN: 'test_influx_token',
            INFLUX_ORG: 'CONAGUA',
            INFLUX_BUCKET: 'telemetria_sitios',
        },
    },
});
