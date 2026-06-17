const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'vuwaqmwgvldqmmgkpyjh';
const DB_PASSWORD = 'q1hHKLnskIixm6Qa';
const connectionString = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

async function runMigrations() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Connected to Supabase DB');

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const specificFiles = process.argv[2] ? process.argv.slice(2) : files;

    for (const file of specificFiles) {
      const filePath = path.join(migrationsDir, file);
      if (!fs.existsSync(filePath)) {
        console.log(`  - ${file} (not found, skipping)`);
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf-8');
      console.log(`Running migration: ${file}`);
      try {
        await client.query(sql);
        console.log(`  ✓ ${file}`);
      } catch (err) {
        console.error(`  ✗ ${file}: ${err.message}`);
      }
    }

    console.log('\nAll migrations completed');
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
