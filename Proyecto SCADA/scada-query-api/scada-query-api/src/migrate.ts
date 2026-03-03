// src/migrate.ts — Simple migration runner
// Usage: npx ts-node src/migrate.ts

import { pool } from './services/db-service';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function run() {
    // 1. Ensure the migrations tracking table exists
    await pool.query(`
        CREATE TABLE IF NOT EXISTS scada.migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    // 2. Get already-applied migrations
    const applied = await pool.query('SELECT filename FROM scada.migrations ORDER BY filename');
    const appliedSet = new Set(applied.rows.map((r: any) => r.filename));

    // 3. Read migration files, sort by name
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    if (files.length === 0) {
        console.log('No migration files found.');
        await pool.end();
        return;
    }

    let count = 0;
    for (const file of files) {
        if (appliedSet.has(file)) {
            console.log(`  [skip] ${file} (already applied)`);
            continue;
        }

        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
        console.log(`  [run]  ${file} ...`);

        try {
            await pool.query('BEGIN');
            await pool.query(sql);
            await pool.query(
                'INSERT INTO scada.migrations (filename) VALUES ($1)',
                [file]
            );
            await pool.query('COMMIT');
            count++;
            console.log(`         OK`);
        } catch (err: any) {
            await pool.query('ROLLBACK');
            console.error(`  [FAIL] ${file}: ${err.message}`);
            process.exit(1);
        }
    }

    console.log(`\nDone. ${count} migration(s) applied.`);
    await pool.end();
}

run().catch(err => {
    console.error('Migration runner error:', err);
    process.exit(1);
});
