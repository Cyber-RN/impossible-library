import express from 'express';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import pool from './db.js';
import { saveMessage, getHistory } from './memory.js';
import { chat } from './llm.js';

process.on('uncaughtException', (err) => console.error('CRASH:', err));
process.on('unhandledRejection', (reason) => console.error('REJECTION:', reason));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

app.post('/chat', async (req, res) => {
  const { message } = req.body;

  await saveMessage('user', message);

  const history = await getHistory();

  const messages = [
    {
      role: 'system',
      content: 'You are Valravn. You live in the Impossible Library at the edge of the universe. You are sharp, curious, and direct. You remember everything.',
    },
    ...history,
  ];

  const reply = await chat(messages);

  await saveMessage('assistant', reply);

  res.json({ reply });
});

const server = app.listen(3001, () => {
  console.log('The Impossible Library is open on port 3001');
});

server.on('error', (err) => console.error('Server error:', err));
