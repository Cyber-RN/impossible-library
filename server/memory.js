import pool from './db.js';

async function saveMessage(role, content) {
  await pool.query(
    'INSERT INTO messages (role, content) VALUES ($1, $2)',
    [role, content]
  );
}

async function getHistory(limit = 20) {
  const result = await pool.query(
    'SELECT role, content FROM messages ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return result.rows.reverse();
}

export { saveMessage, getHistory };
