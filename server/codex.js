import pool from './db.js';

async function saveCodexEntry(topic, sourceUrl, content, reflection) {
  const result = await pool.query(
    'INSERT INTO codex (topic, source_url, content, reflection) VALUES ($1, $2, $3, $4) RETURNING id',
    [topic, sourceUrl, content, reflection]
  );
  return result.rows[0].id;
}

async function getCodexEntries() {
  const result = await pool.query(
    'SELECT id, topic, source_url, content, reflection, created_at FROM codex ORDER BY created_at DESC'
  );
  return result.rows;
}

async function deleteCodexEntry(id) {
  await pool.query('DELETE FROM codex WHERE id = $1', [id]);
}

async function promoteToMemory(id) {
  const result = await pool.query('SELECT topic, reflection FROM codex WHERE id = $1', [id]);
  if (result.rows.length === 0) return;
  const { topic, reflection } = result.rows[0];
  await pool.query(
    'INSERT INTO memories (content) VALUES ($1)',
    [`[Codex: ${topic}] ${reflection}`]
  );
}

export { saveCodexEntry, getCodexEntries, deleteCodexEntry, promoteToMemory };
