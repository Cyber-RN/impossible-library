import pool from './db.js';

async function createConversation(firstMessage) {
  const title = firstMessage.slice(0, 50);
  const result = await pool.query(
    'INSERT INTO conversations (title) VALUES ($1) RETURNING id',
    [title]
  );
  return result.rows[0].id;
}

async function getConversations() {
  const result = await pool.query(
    'SELECT id, title, created_at FROM conversations ORDER BY created_at DESC'
  );
  return result.rows;
}

async function saveMessage(conversationId, role, content) {
  const result = await pool.query(
    'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id',
    [conversationId, role, content]
  );
  return result.rows[0].id;
}

async function getHistory(conversationId, limit = 20) {
  const result = await pool.query(
    'SELECT id, role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2',
    [conversationId, limit]
  );
  return result.rows.reverse();
}

async function deleteMessage(id) {
  await pool.query('DELETE FROM messages WHERE id = $1', [id]);
}

async function renameConversation(conversationId, title) {
  await pool.query('UPDATE conversations SET title = $1 WHERE id = $2', [title, conversationId]);
}

async function clearConversation(conversationId) {
  await pool.query('DELETE FROM conversations WHERE id = $1', [conversationId]);
}

export { createConversation, getConversations, saveMessage, getHistory, deleteMessage, renameConversation, clearConversation };
