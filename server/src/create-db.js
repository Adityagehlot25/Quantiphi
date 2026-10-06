import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Connect to the default 'postgres' database to create the new one
const connectionString = process.env.DATABASE_URL.replace(/\/taskmanager$/, '/postgres');

const pool = new Pool({
  connectionString: connectionString,
});

async function createDb() {
  try {
    console.log('Connecting to default database...');
    // Check if database exists
    const res = await pool.query("SELECT 1 FROM pg_database WHERE datname = 'taskmanager'");
    if (res.rowCount === 0) {
      console.log('Creating database taskmanager...');
      await pool.query('CREATE DATABASE taskmanager');
      console.log('Database taskmanager created successfully.');
    } else {
      console.log('Database taskmanager already exists.');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error creating database:', error);
    process.exit(1);
  }
}

createDb();
