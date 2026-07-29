const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// Storage setup
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Initialize Database
async function initDatabase() {
  let seedData = {};
  const seedPath = path.join(__dirname, 'seed-backup.json');
  if (fs.existsSync(seedPath)) {
    try {
      const rawSeed = fs.readFileSync(seedPath, 'utf-8');
      const parsed = JSON.parse(rawSeed);
      seedData = parsed.appData || parsed;
    } catch (err) {
      console.error('Error reading seed-backup.json:', err);
    }
  }

  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          id SERIAL PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const res = await pool.query('SELECT COUNT(*) FROM app_state');
      if (parseInt(res.rows[0].count) === 0) {
        console.log('Database empty. Seeding from seed-backup.json...');
        await saveDatabase(seedData);
      } else {
        console.log('Postgres Database ready.');
      }
    } catch (err) {
      console.error('Error initializing Postgres DB:', err);
    }
  } else {
    if (!fs.existsSync(DB_FILE)) {
      console.log('Database file not found. Seeding from seed-backup.json...');
      await saveDatabase(seedData);
    } else {
      console.log('File Database ready at:', DB_FILE);
    }
  }
}

async function getDatabase() {
  if (pool) {
    try {
      const res = await pool.query('SELECT data, updated_at FROM app_state ORDER BY id DESC LIMIT 1');
      if (res.rows.length > 0) {
        return { updatedAt: res.rows[0].updated_at, appData: res.rows[0].data };
      }
    } catch (err) {
      console.error('Error reading from Postgres:', err);
    }
    return {};
  } else {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading DB_FILE:', err);
    }
    return {};
  }
}

async function saveDatabase(appData) {
  if (pool) {
    try {
      // Upsert into row with id 1
      await pool.query(`
        INSERT INTO app_state (id, data, updated_at) 
        VALUES (1, $1, NOW()) 
        ON CONFLICT (id) 
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `, [appData]);
      return true;
    } catch (err) {
      console.error('Failed to save to Postgres:', err);
      return false;
    }
  } else {
    try {
      const payload = {
        updatedAt: new Date().toISOString(),
        appData: appData
      };
      const jsonStr = JSON.stringify(payload, null, 2);

      // Atomic write to temporary file first, then rename
      const tempFile = path.join(DATA_DIR, 'db.tmp.json');
      fs.writeFileSync(tempFile, jsonStr, 'utf-8');
      fs.renameSync(tempFile, DB_FILE);

      // Also write a timestamped safety backup
      const snapshotFile = path.join(BACKUP_DIR, `backup-${Date.now()}.json`);
      fs.writeFileSync(snapshotFile, jsonStr, 'utf-8');

      // Keep only the latest 20 backup files
      const backups = fs.readdirSync(BACKUP_DIR).sort();
      if (backups.length > 20) {
        backups.slice(0, backups.length - 20).forEach(b => {
          try { fs.unlinkSync(path.join(BACKUP_DIR, b)); } catch(e) {}
        });
      }
      return true;
    } catch (err) {
      console.error('Failed to save database:', err);
      return false;
    }
  }
}

// REST API Endpoints

// GET /api/health
app.get('/api/health', async (req, res) => {
  const db = await getDatabase();
  const problems = db?.appData?.problems || [];
  res.json({
    status: 'ok',
    storage: pool ? 'PostgreSQL' : 'Persistent JSON DB',
    dbFile: pool ? 'Database' : DB_FILE,
    totalProblems: problems.length,
    problems: problems.map(p => ({ id: p.id, name: p.name, topic: p.topic }))
  });
});

// GET /api/data - Load full application state
app.get('/api/data', async (req, res) => {
  const db = await getDatabase();
  res.json({
    success: true,
    updatedAt: db.updatedAt,
    appData: db.appData || {}
  });
});

// POST /api/data - Save full application state
app.post('/api/data', async (req, res) => {
  const appData = req.body.appData || req.body;
  if (!appData || typeof appData !== 'object') {
    return res.status(400).json({ error: 'Invalid app data' });
  }

  const ok = await saveDatabase(appData);
  if (ok) {
    res.json({ success: true, message: 'Data safely stored in database' });
  } else {
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// GET /api/problems - List all questions
app.get('/api/problems', async (req, res) => {
  const db = await getDatabase();
  res.json({ success: true, problems: db?.appData?.problems || [] });
});

// POST /api/problems - Add or update a problem
app.post('/api/problems', async (req, res) => {
  const problem = req.body;
  if (!problem || !problem.name) {
    return res.status(400).json({ error: 'Problem name required' });
  }

  const db = await getDatabase();
  db.appData = db.appData || {};
  db.appData.problems = Array.isArray(db.appData.problems) ? db.appData.problems : [];

  const idx = db.appData.problems.findIndex(p => p.id === problem.id);
  if (idx >= 0) {
    db.appData.problems[idx] = { ...db.appData.problems[idx], ...problem };
  } else {
    if (!problem.id) problem.id = 'p_' + Date.now().toString(36);
    db.appData.problems.push(problem);
  }

  await saveDatabase(db.appData);
  res.json({ success: true, problem: problem, totalProblems: db.appData.problems.length });
});

// GET /api/backup/download
app.get('/api/backup/download', async (req, res) => {
  const db = await getDatabase();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=gazette-backup-${Date.now()}.json`);
  res.send(JSON.stringify({ version: 'AZ_GAZETTE_BACKEND_BACKUP', appData: db.appData }, null, 2));
});

// SPA fallback for all unhandled GET routes
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    next();
  }
});

// Initialize database & start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Gazette Express Backend running on http://localhost:${PORT}`);
    console.log(`Storage backend: ${pool ? 'PostgreSQL' : 'Local File System'}`);
    console.log(`====================================================`);
  });
});
