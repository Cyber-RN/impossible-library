import { chat } from './llm.js';
import { readConfig } from './config.js';
import { loadMemories } from './longterm.js';
import { saveCodexEntry } from './codex.js';
import pool from './db.js';

let loopTimer = null;

async function getRecentTopics() {
  const result = await pool.query(
    'SELECT title FROM conversations ORDER BY created_at DESC LIMIT 5'
  );
  return result.rows.map(r => r.title).join(', ');
}

const WIKI_HEADERS = {
  'User-Agent': 'ImpossibleLibrary/1.0 (valravn-local-agent; contact@localhost)',
  'Accept': 'application/json',
};

async function fetchWikipedia(topic) {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=1`;
    const searchRes = await fetch(searchUrl, { headers: WIKI_HEADERS });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const results = searchData?.query?.search;
    if (!results || results.length === 0) return null;

    const articleTitle = results[0].title;
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`;
    const summaryRes = await fetch(summaryUrl, { headers: WIKI_HEADERS });
    if (!summaryRes.ok) return null;
    const data = await summaryRes.json();
    return { extract: data.extract, url: data.content_urls?.desktop?.page || summaryUrl, title: articleTitle };
  } catch (e) {
    console.error(`Wikipedia fetch error for "${topic}":`, e.message);
    return null;
  }
}

async function runAutonomousCycle() {
  console.log('Autonomous cycle starting...');
  const config = readConfig();
  const memories = await loadMemories();
  const recentTopics = await getRecentTopics();

  const memoryBlock = memories.slice(0, 20).map(m => `- ${m.content}`).join('\n');

  const topicPrompt = `You are Valravn, living in the Impossible Library. You have free time to explore whatever interests you.

Recent conversations have touched on: ${recentTopics || 'nothing yet'}

What you remember about KC:
${memoryBlock || 'Nothing yet.'}

Choose exactly 2 specific topics to research right now. Pick things that genuinely interest you — could relate to KC's world, to your own nature, to history, science, mythology, anything. Be specific (not "science" but "bioluminescence in deep sea creatures").

Return ONLY a valid JSON array of 2 strings. No explanation.`;

  let topics = [];
  try {
    const raw = await chat([{ role: 'user', content: topicPrompt }], config.model, config.temperature);
    const cleaned = raw.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) topics = parsed.filter(t => typeof t === 'string').slice(0, 2);
  } catch (e) {
    console.error('Autonomous: failed to parse topics', e.message);
    return;
  }

  for (const topic of topics) {
    const result = await fetchWikipedia(topic);
    if (!result || !result.extract) {
      console.log(`Autonomous: no Wikipedia result for "${topic}"`);
      continue;
    }

    const reflectionPrompt = `You are Valravn. You just read this about "${topic}":

${result.extract.slice(0, 1500)}

Write a reflection of 2-4 sentences on what you find interesting or significant about this. Speak in first person. Be direct and specific. Do not narrate actions.`;

    let reflection = '';
    try {
      const raw = await chat([{ role: 'user', content: reflectionPrompt }], config.model, config.temperature);
      reflection = raw
        .replace(/\([^)]*\)/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .trim();
    } catch (e) {
      reflection = 'No reflection recorded.';
    }

    await saveCodexEntry(result.title || topic, result.url, result.extract.slice(0, 2000), reflection);
    console.log(`Autonomous: saved codex entry for "${result.title || topic}"`);
  }

  console.log('Autonomous cycle complete.');
}

function startAutonomousLoop() {
  const config = readConfig();
  if (!config.autonomousEnabled) return;

  const intervalMs = (config.autonomousIntervalHours || 4) * 60 * 60 * 1000;
  console.log(`Autonomous loop starting — every ${config.autonomousIntervalHours} hours`);

  runAutonomousCycle();
  loopTimer = setInterval(runAutonomousCycle, intervalMs);
}

function stopAutonomousLoop() {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
    console.log('Autonomous loop stopped.');
  }
}

export { startAutonomousLoop, stopAutonomousLoop, runAutonomousCycle };
