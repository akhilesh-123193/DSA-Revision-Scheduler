const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// Ensure data directory and backups directory exist
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Initialize Database from seed-backup.json if db.json does not exist
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    console.log('Database file not found. Seeding from seed-backup.json...');
    const seedPath = path.join(__dirname, 'seed-backup.json');
    let seedData = {};
    if (fs.existsSync(seedPath)) {
      try {
        const rawSeed = fs.readFileSync(seedPath, 'utf-8');
        const parsed = JSON.parse(rawSeed);
        seedData = parsed.appData || parsed;
      } catch (err) {
        console.error('Error reading seed-backup.json:', err);
      }
    }
    saveDatabase(seedData);
  } else {
    console.log('Database ready at:', DB_FILE);
  }
}

function getDatabase() {
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

function saveDatabase(appData) {
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

// REST API Endpoints

// GET /api/health
app.get('/api/health', (req, res) => {
  const db = getDatabase();
  const problems = db?.appData?.problems || [];
  res.json({
    status: 'ok',
    storage: 'Persistent JSON DB',
    dbFile: DB_FILE,
    totalProblems: problems.length,
    problems: problems.map(p => ({ id: p.id, name: p.name, topic: p.topic }))
  });
});

// GET /api/data - Load full application state
app.get('/api/data', (req, res) => {
  const db = getDatabase();
  res.json({
    success: true,
    updatedAt: db.updatedAt,
    appData: db.appData || {}
  });
});

// POST /api/data - Save full application state
app.post('/api/data', (req, res) => {
  const appData = req.body.appData || req.body;
  if (!appData || typeof appData !== 'object') {
    return res.status(400).json({ error: 'Invalid app data' });
  }

  const ok = saveDatabase(appData);
  if (ok) {
    res.json({ success: true, message: 'Data safely stored in database' });
  } else {
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// GET /api/problems - List all questions
app.get('/api/problems', (req, res) => {
  const db = getDatabase();
  res.json({ success: true, problems: db?.appData?.problems || [] });
});

// POST /api/problems - Add or update a problem
app.post('/api/problems', (req, res) => {
  const problem = req.body;
  if (!problem || !problem.name) {
    return res.status(400).json({ error: 'Problem name required' });
  }

  const db = getDatabase();
  db.appData = db.appData || {};
  db.appData.problems = Array.isArray(db.appData.problems) ? db.appData.problems : [];

  const idx = db.appData.problems.findIndex(p => p.id === problem.id);
  if (idx >= 0) {
    db.appData.problems[idx] = { ...db.appData.problems[idx], ...problem };
  } else {
    if (!problem.id) problem.id = 'p_' + Date.now().toString(36);
    db.appData.problems.push(problem);
  }

  saveDatabase(db.appData);
  res.json({ success: true, problem: problem, totalProblems: db.appData.problems.length });
});

// GET /api/backup/download
app.get('/api/backup/download', (req, res) => {
  const db = getDatabase();
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
initDatabase();

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Gazette Express Backend running on http://localhost:${PORT}`);
  console.log(`Persistent Database File: ${DB_FILE}`);
  console.log(`====================================================`);
});
