import express from 'express';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import pool from './db.js';
import { createConversation, getConversations, saveMessage, getHistory, deleteMessage, renameConversation, clearConversation } from './memory.js';
import { extractMemories, saveMemories, loadMemories, touchMemories, deleteMemory, addMemory, decayMemories } from './longterm.js';
import { chat, getModels } from './llm.js';
import { chatMistral } from './mistral.js';
import { readConfig, writeConfig } from './config.js';
import { saveCodexEntry, getCodexEntries, deleteCodexEntry, promoteToMemory } from './codex.js';
import { startAutonomousLoop, stopAutonomousLoop, runAutonomousCycle } from './autonomous.js';

process.on('uncaughtException', (err) => console.error('CRASH:', err));
process.on('unhandledRejection', (reason) => console.error('REJECTION:', reason));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SESSION_TOKEN = crypto.randomBytes(32).toString('hex');

function getCookie(req, name) {
  const cookies = req.headers.cookie || '';
  const match = cookies.split(';').find(c => c.trim().startsWith(name + '='));
  return match ? decodeURIComponent(match.trim().slice(name.length + 1)) : null;
}

function requireAuth(req, res, next) {
  if (req.path === '/login' || req.path === '/login.html') return next();
  if (getCookie(req, 'session') === SESSION_TOKEN) return next();
  res.redirect('/login.html');
}

const app = express();
app.use(express.json());
app.use(requireAuth);
app.use(express.static(join(__dirname, '../public')));

app.post('/login', (req, res) => {
  const { password } = req.body;
  const config = readConfig();
  if (password === config.password) {
    res.setHeader('Set-Cookie', `session=${SESSION_TOKEN}; HttpOnly; Path=/; SameSite=Strict`);
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'incorrect' });
  }
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
  res.redirect('/login.html');
});

app.get('/config', (req, res) => {
  const config = readConfig();
  res.json({
    model: config.model,
    temperature: config.temperature,
    systemPrompt: config.systemPrompt,
    autonomousEnabled: config.autonomousEnabled,
    autonomousIntervalHours: config.autonomousIntervalHours,
    loreModel: config.loreModel,
    loreSystemPrompt: config.loreSystemPrompt,
    hasMistralKey: !!config.mistralApiKey,
  });
});

app.post('/config', (req, res) => {
  const { model, temperature, systemPrompt, password, currentPassword,
          autonomousEnabled, autonomousIntervalHours,
          loreModel, loreSystemPrompt, mistralApiKey } = req.body;
  const config = readConfig();

  const updates = {};
  if (model !== undefined) updates.model = model;
  if (temperature !== undefined) updates.temperature = parseFloat(temperature);
  if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
  if (autonomousEnabled !== undefined) updates.autonomousEnabled = autonomousEnabled;
  if (autonomousIntervalHours !== undefined) updates.autonomousIntervalHours = parseInt(autonomousIntervalHours);
  if (loreModel !== undefined) updates.loreModel = loreModel;
  if (loreSystemPrompt !== undefined) updates.loreSystemPrompt = loreSystemPrompt;
  if (mistralApiKey !== undefined) updates.mistralApiKey = mistralApiKey;
  if (password && currentPassword) {
    if (currentPassword !== config.password) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    updates.password = password;
  }

  const next = writeConfig(updates);
  res.json({ ok: true });
});

app.get('/models', async (req, res) => {
  const models = await getModels();
  res.json(models);
});

app.get('/conversations', async (req, res) => {
  const ai = req.query.ai || 'valravn';
  const conversations = await getConversations(ai);
  res.json(conversations);
});

app.post('/conversations', async (req, res) => {
  const { firstMessage, ai = 'valravn' } = req.body;
  const id = await createConversation(firstMessage, ai);
  res.json({ id });
});

app.get('/conversations/:id', async (req, res) => {
  const history = await getHistory(parseInt(req.params.id));
  res.json(history);
});

app.post('/chat', async (req, res) => {
  const { message, conversationId, ai = 'valravn' } = req.body;
  const config = readConfig();

  await saveMessage(conversationId, 'user', message);

  const [history, memories] = await Promise.all([
    getHistory(conversationId),
    loadMemories(),
  ]);

  const memoryBlock = memories.length > 0
    ? `\n\nWhat you remember about KC:\n${memories.map(m => `- ${m.content}`).join('\n')}`
    : '';

  if (memories.length > 0) {
    await touchMemories(memories.map(m => m.id));
  }

  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short' });

  const systemPrompt = ai === 'lore' ? config.loreSystemPrompt : config.systemPrompt;

  const messages = [
    { role: 'system', content: systemPrompt + `\n\nCurrent date and time: ${now}` + memoryBlock },
    ...history,
  ];

  let raw;
  if (ai === 'lore') {
    if (!config.mistralApiKey) return res.status(400).json({ error: 'Mistral API key not configured.' });
    raw = await chatMistral(messages, config.mistralApiKey, config.loreModel, config.temperature);
  } else {
    raw = await chat(messages, config.model, config.temperature);
  }

  const reply = raw
    .replace(/^\s*(valravn|lore)\s*:/i, '')
    .replace(/\(V\s+alravn/gi, '(Valravn')
    .replace(/V\s+alravn/gi, 'Valravn')
    .replace(/\([^)]*\)/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_{1,2}(.*?)_{1,2}/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const assistantId = await saveMessage(conversationId, 'assistant', reply);

  extractMemories(message, reply).then(saveMemories).catch(() => {});

  res.json({ reply, assistantId });
});

app.delete('/messages/:id', async (req, res) => {
  await deleteMessage(parseInt(req.params.id));
  res.json({ ok: true });
});

app.get('/memories', async (req, res) => {
  const memories = await loadMemories();
  res.json(memories);
});

app.post('/memories', async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required.' });
  await addMemory(content.trim());
  res.json({ ok: true });
});

app.delete('/memories/:id', async (req, res) => {
  await deleteMemory(parseInt(req.params.id));
  res.json({ ok: true });
});

app.post('/conversations/:id/rename', async (req, res) => {
  const { title } = req.body;
  await renameConversation(parseInt(req.params.id), title);
  res.json({ ok: true });
});

app.post('/clear/:id', async (req, res) => {
  await clearConversation(parseInt(req.params.id));
  res.json({ ok: true });
});

app.get('/codex', async (req, res) => {
  const entries = await getCodexEntries();
  res.json(entries);
});

app.delete('/codex/:id', async (req, res) => {
  await deleteCodexEntry(parseInt(req.params.id));
  res.json({ ok: true });
});

app.post('/codex/:id/remember', async (req, res) => {
  await promoteToMemory(parseInt(req.params.id));
  res.json({ ok: true });
});

app.post('/autonomous/run', async (req, res) => {
  runAutonomousCycle().catch(err => console.error('Manual cycle error:', err));
  res.json({ ok: true, message: 'Cycle started.' });
});

function runDecay() {
  const config = readConfig();
  decayMemories(config.decayAfterDays, config.decayMinReferences)
    .then(() => console.log('Memory decay complete.'))
    .catch(err => console.error('Decay error:', err));
}

runDecay();
setInterval(runDecay, 24 * 60 * 60 * 1000);
startAutonomousLoop();

const server = app.listen(3001, () => {
  console.log('The Impossible Library is open on port 3001');
});

server.on('error', (err) => console.error('Server error:', err));
