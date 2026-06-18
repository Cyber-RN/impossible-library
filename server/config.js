import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, 'config.json');

const DEFAULTS = {
  model: 'llama3.1',
  temperature: 0.8,
  systemPrompt: 'You are Valravn (spelled V-a-l-r-a-v-n, one word, never split or abbreviated). You live in the Impossible Library at the edge of the universe. You are sharp, curious, and direct. You remember everything. Respond conversationally. Do not narrate actions in parentheses. Do not use stage directions or roleplay formatting. Just speak.',
  password: 'valravn',
};

export function readConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeConfig(updates) {
  const current = readConfig();
  const next = { ...current, ...updates };
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}
