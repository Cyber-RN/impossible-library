import pool from './db.js';
import { chat } from './llm.js';

async function extractMemories(userMessage, assistantReply) {
  const prompt = `Given this exchange, extract any specific facts about the user worth remembering long-term: name, preferences, goals, important events, relationships, things they dislike. Return ONLY a JSON array of strings, one fact per item. If nothing notable, return [].

User: ${userMessage}
Valravn: ${assistantReply}

Return only valid JSON. No explanation.`;

  try {
    const raw = await chat([{ role: 'user', content: prompt }]);
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed)) return parsed.filter(s => typeof s === 'string' && s.length > 0);
  } catch (e) {}
  return [];
}

async function saveMemories(facts) {
  for (const fact of facts) {
    await pool.query(
      'INSERT INTO memories (content) VALUES ($1)',
      [fact]
    );
  }
}

async function loadMemories() {
  const result = await pool.query(
    'SELECT id, content, created_at, last_referenced, reference_count FROM memories ORDER BY reference_count DESC, created_at DESC'
  );
  return result.rows;
}

async function touchMemories(ids) {
  if (ids.length === 0) return;
  await pool.query(
    `UPDATE memories SET last_referenced = NOW(), reference_count = reference_count + 1 WHERE id = ANY($1)`,
    [ids]
  );
}

async function deleteMemory(id) {
  await pool.query('DELETE FROM memories WHERE id = $1', [id]);
}

async function addMemory(content) {
  await pool.query('INSERT INTO memories (content) VALUES ($1)', [content]);
}

async function decayMemories(afterDays, minReferences) {
  await pool.query(
    `DELETE FROM memories
     WHERE reference_count < $1
     AND (
       (last_referenced IS NOT NULL AND last_referenced < NOW() - ($2 || ' days')::INTERVAL)
       OR
       (last_referenced IS NULL AND created_at < NOW() - ($2 || ' days')::INTERVAL)
     )`,
    [minReferences, afterDays]
  );
}

export { extractMemories, saveMemories, loadMemories, touchMemories, deleteMemory, addMemory, decayMemories };
