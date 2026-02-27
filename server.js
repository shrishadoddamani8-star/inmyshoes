const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// Fix for Railway proxy
app.set('trust proxy', 1);

const pool = new Pool({
  connectionString: 'postgresql://postgres:ejOKPZcytJSuQrmBQwFGbrtjMNwHFvan@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        ts BIGINT NOT NULL
      )
    `);
    console.log('database ready');
  } catch(e) {
    console.error('db init error:', e.message);
  }
}
initDB();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/', limiter);

const BAD = ['fuck','shit','bitch','asshole','cunt','dick','nigger','faggot'];
function dirty(t) { return BAD.some(w => new RegExp(`\\b${w}\\b`, 'i').test(t)); }

app.post('/api/notes', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string') return res.status(400).json({ error: 'empty note.' });
    const t = content.trim();
    if (!t.length) return res.status(400).json({ error: 'note cannot be empty.' });
    if (t.length > 150) return res.status(400).json({ error: 'too long. 150 chars max.' });
    if (dirty(t)) return res.status(400).json({ error: 'please keep it gentle.' });
    await pool.query('INSERT INTO notes (content, ts) VALUES ($1, $2)', [t, Date.now()]);
    res.json({ ok: true });
  } catch(e) {
    console.error('save error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/notes/random', async (req, res) => {
  try {
    const exclude = parseInt(req.query.exclude) || -1;
    let result = await pool.query('SELECT * FROM notes WHERE id != $1 ORDER BY RANDOM() LIMIT 1', [exclude]);
    let note = result.rows[0];
    if (!note) {
      result = await pool.query('SELECT * FROM notes ORDER BY RANDOM() LIMIT 1');
      note = result.rows[0];
    }
    if (!note) return res.status(404).json({ error: 'no notes yet. be the first.' });
    const total = (await pool.query('SELECT COUNT(*) as c FROM notes')).rows[0].c;
    const d = new Date(parseInt(note.ts));
    let h = d.getHours(), m = d.getMinutes().toString().padStart(2,'0');
    const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
    res.json({ id: note.id, content: note.content, time: `${h}:${m} ${ap}`, total });
  } catch(e) {
    console.error('random error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/notes/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notes ORDER BY ts DESC');
    res.json({ total: result.rows.length, notes: result.rows });
  } catch(e) {
    console.error('all error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`in my shoes — port ${PORT}`));
