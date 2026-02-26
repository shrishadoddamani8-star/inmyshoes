const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const db = new Database(path.join(__dirname, 'notes.db'));

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    ts INTEGER NOT NULL
  )
`);

// Seed notes if empty
const count = db.prepare('SELECT COUNT(*) as c FROM notes').get();
if (count.c === 0) {
  const seeds = [
    "i haven't called my mom back in three weeks and every day feels heavier.",
    "i'm pretending i'm okay with being alone. i'm not.",
    "i laughed today and it surprised me.",
    "i keep starting over. i don't know if that makes me resilient or just tired.",
    "i miss someone who is still alive.",
    "i'm scared the best part of my life is already behind me.",
    "today i let myself cry in the car. it helped.",
    "i told a stranger their dog was beautiful and meant it completely.",
    "i don't know who i am without the version of me people expect.",
    "i made something today. it wasn't good. i made it anyway.",
    "i'm still carrying something from five years ago. i don't know how to put it down.",
    "i wish someone would ask how i actually am.",
    "i'm proud of something small that nobody noticed.",
    "i think i'm finally becoming who i was supposed to be.",
    "i said yes when i meant no. again.",
  ];
  const stmt = db.prepare('INSERT INTO notes (content, ts) VALUES (?, ?)');
  seeds.forEach(c => stmt.run(c, Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limit
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/', limiter);

// Profanity filter
const BAD = ['fuck','shit','bitch','asshole','cunt','dick','nigger','faggot'];
function dirty(t) { return BAD.some(w => new RegExp(`\\b${w}\\b`, 'i').test(t)); }

// POST — save a note
app.post('/api/notes', (req, res) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string') return res.status(400).json({ error: 'empty note.' });
  const t = content.trim();
  if (!t.length) return res.status(400).json({ error: 'note cannot be empty.' });
  if (t.length > 150) return res.status(400).json({ error: 'too long. 150 chars max.' });
  if (dirty(t)) return res.status(400).json({ error: 'please keep it gentle.' });
  db.prepare('INSERT INTO notes (content, ts) VALUES (?, ?)').run(t, Date.now());
  res.json({ ok: true });
});

// GET — random note
app.get('/api/notes/random', (req, res) => {
  const exclude = parseInt(req.query.exclude) || -1;
  let note = db.prepare('SELECT * FROM notes WHERE id != ? ORDER BY RANDOM() LIMIT 1').get(exclude);
  if (!note) note = db.prepare('SELECT * FROM notes ORDER BY RANDOM() LIMIT 1').get();
  if (!note) return res.status(404).json({ error: 'no notes yet. be the first.' });
  const total = db.prepare('SELECT COUNT(*) as c FROM notes').get().c;
  const d = new Date(note.ts);
  let h = d.getHours(), m = d.getMinutes().toString().padStart(2,'0');
  const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
  res.json({ id: note.id, content: note.content, time: `${h}:${m} ${ap}`, total });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`in my shoes — port ${PORT}`));
