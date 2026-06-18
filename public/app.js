const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatWindow = document.getElementById('chat-window');
const landing = document.getElementById('landing');
const chatPanel = document.getElementById('chat-panel');
const settingsPanel = document.getElementById('settings-panel');
const conversationList = document.getElementById('conversation-list');

const codexPanel = document.getElementById('codex-panel');
const navBtns = document.querySelectorAll('.nav-btn');

let currentConversationId = null;
let currentAI = 'valravn';

function switchAI(ai) {
  currentAI = ai;
  currentConversationId = null;
  chatWindow.innerHTML = '';

  document.getElementById('btn-valravn').classList.toggle('active', ai === 'valravn');
  document.getElementById('btn-lore').classList.toggle('active', ai === 'lore');

  const nameEl = document.getElementById('chat-ai-name');
  const subtitleEl = document.getElementById('chat-ai-subtitle');
  if (ai === 'lore') {
    nameEl.textContent = 'Lore';
    subtitleEl.textContent = 'watching.';
  } else {
    nameEl.textContent = 'Valravn';
    subtitleEl.textContent = 'listening.';
  }

  loadConversations();
}

function enterAs(ai) {
  switchAI(ai);
  showChat();
}

function setActiveNav(id) {
  navBtns.forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById(id);
  if (btn) btn.classList.add('active');
}

function showLanding() {
  landing.classList.remove('hidden');
  chatPanel.classList.add('hidden');
  codexPanel.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  setActiveNav('btn-library');
}

async function showChat() {
  landing.classList.add('hidden');
  chatPanel.classList.remove('hidden');
  codexPanel.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  setActiveNav('btn-chat');
  await loadConversations();
  if (!currentConversationId) {
    await newConversation();
  }
  input.focus();
}

async function showCodex() {
  landing.classList.add('hidden');
  chatPanel.classList.add('hidden');
  codexPanel.classList.remove('hidden');
  settingsPanel.classList.add('hidden');
  setActiveNav('btn-codex');
  await loadCodex();
}

async function loadCodex() {
  const res = await fetch('/codex');
  const entries = await res.json();
  const list = document.getElementById('codex-list');
  list.innerHTML = '';

  if (entries.length === 0) {
    list.innerHTML = '<div class="codex-empty">The codex is empty. Enable autonomous research in Settings, or hit Run Now.</div>';
    return;
  }

  entries.forEach(e => {
    const card = document.createElement('div');
    card.className = 'codex-card';

    const date = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    card.innerHTML = `
      <div class="codex-topic">${e.topic}</div>
      <div class="codex-date">${date}</div>
      <div class="codex-reflection">${e.reflection || ''}</div>
      <div class="codex-source"><a href="${e.source_url}" target="_blank">Source</a></div>
      <div class="codex-actions">
        <button class="codex-btn remember" onclick="rememberCodexEntry(${e.id}, this)">Remember</button>
        <button class="codex-btn delete" onclick="deleteCodexEntry(${e.id}, this)">Delete</button>
      </div>
    `;

    list.appendChild(card);
  });
}

async function deleteCodexEntry(id, btn) {
  await fetch(`/codex/${id}`, { method: 'DELETE' });
  btn.closest('.codex-card').remove();
}

async function rememberCodexEntry(id, btn) {
  await fetch(`/codex/${id}/remember`, { method: 'POST' });
  btn.textContent = 'Remembered';
  btn.disabled = true;
  btn.style.color = '#8a7fff';
}

async function triggerAutonomousCycle() {
  const btn = document.getElementById('codex-run-btn');
  btn.textContent = 'Running...';
  btn.disabled = true;
  await fetch('/autonomous/run', { method: 'POST' });
  setTimeout(async () => {
    await loadCodex();
    btn.textContent = 'Run Now';
    btn.disabled = false;
  }, 30000);
}

async function showSettings() {
  landing.classList.add('hidden');
  chatPanel.classList.add('hidden');
  codexPanel.classList.add('hidden');
  settingsPanel.classList.remove('hidden');
  setActiveNav('btn-settings');
  await Promise.all([loadSettingsForm(), loadMemoryVault()]);
}

async function loadSettingsForm() {
  const [configRes, modelsRes] = await Promise.all([
    fetch('/config'),
    fetch('/models'),
  ]);
  const config = await configRes.json();
  const models = await modelsRes.json();

  const select = document.getElementById('setting-model');
  select.innerHTML = '';
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    if (m === config.model || m.startsWith(config.model + ':') || config.model.startsWith(m.split(':')[0])) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });

  const tempEl = document.getElementById('setting-temp');
  tempEl.value = config.temperature;
  document.getElementById('temp-display').textContent = config.temperature;

  document.getElementById('setting-prompt').value = config.systemPrompt;
  document.getElementById('setting-lore-prompt').value = config.loreSystemPrompt || '';
  if (!config.hasMistralKey) {
    document.getElementById('setting-mistral-key').placeholder = 'Not set — enter key to enable Lore';
  } else {
    document.getElementById('setting-mistral-key').placeholder = '••••••••••••••••';
  }
  document.getElementById('setting-autonomous').checked = config.autonomousEnabled || false;
  document.getElementById('setting-interval').value = config.autonomousIntervalHours || 4;
}

async function saveSettings() {
  const msg = document.getElementById('settings-msg');
  msg.textContent = '';

  const payload = {
    model: document.getElementById('setting-model').value,
    temperature: document.getElementById('setting-temp').value,
    systemPrompt: document.getElementById('setting-prompt').value,
    loreSystemPrompt: document.getElementById('setting-lore-prompt').value,
    autonomousEnabled: document.getElementById('setting-autonomous').checked,
    autonomousIntervalHours: parseInt(document.getElementById('setting-interval').value),
  };

  const mistralKey = document.getElementById('setting-mistral-key').value.trim();
  if (mistralKey) payload.mistralApiKey = mistralKey;

  const res = await fetch('/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  msg.textContent = res.ok ? 'Saved.' : 'Failed to save.';
  msg.style.color = res.ok ? '#8a7fff' : '#ff6b6b';
  if (res.ok && mistralKey) document.getElementById('setting-mistral-key').value = '';
  setTimeout(() => msg.textContent = '', 2500);
}

async function changePassword() {
  const msg = document.getElementById('pw-msg');
  msg.textContent = '';
  const currentPassword = document.getElementById('pw-current').value;
  const password = document.getElementById('pw-new').value;
  if (!currentPassword || !password) { msg.textContent = 'Both fields required.'; msg.style.color = '#ff6b6b'; return; }
  const res = await fetch('/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, password }),
  });
  if (res.ok) {
    msg.textContent = 'Password changed.';
    msg.style.color = '#8a7fff';
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value = '';
  } else {
    const data = await res.json();
    msg.textContent = data.error || 'Failed.';
    msg.style.color = '#ff6b6b';
  }
  setTimeout(() => msg.textContent = '', 2500);
}

async function loadMemoryVault() {
  const res = await fetch('/memories');
  const memories = await res.json();
  const list = document.getElementById('memory-list');
  list.innerHTML = '';

  if (memories.length === 0) {
    list.innerHTML = '<div class="vault-empty">No memories yet. Talk to Valravn and he will begin to remember.</div>';
    return;
  }

  memories.forEach(m => {
    const entry = document.createElement('div');
    entry.className = 'memory-entry';

    const created = new Date(m.created_at).toLocaleDateString();
    const lastRef = m.last_referenced
      ? new Date(m.last_referenced).toLocaleDateString()
      : 'Never';

    entry.innerHTML = `
      <div class="memory-content">
        <div>${m.content}</div>
        <div class="memory-meta">
          <span>Added ${created}</span>
          <span>Last referenced ${lastRef}</span>
          <span>Referenced ${m.reference_count}x</span>
        </div>
      </div>
      <button class="memory-delete" title="Delete" onclick="removeMemory(${m.id}, this)">✕</button>
    `;

    list.appendChild(entry);
  });
}

async function removeMemory(id, btn) {
  await fetch(`/memories/${id}`, { method: 'DELETE' });
  btn.closest('.memory-entry').remove();
}

async function addManualMemory() {
  const input = document.getElementById('memory-input');
  const content = input.value.trim();
  if (!content) return;
  await fetch('/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  input.value = '';
  await loadMemoryVault();
}


function groupByDate(conversations) {
  const groups = {};
  const now = new Date();

  conversations.forEach(c => {
    const d = new Date(c.created_at);
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

    let label;
    if (diffDays === 0) label = 'Today';
    else if (diffDays === 1) label = 'Yesterday';
    else if (diffDays <= 7) label = 'Last 7 Days';
    else if (diffDays <= 30) label = 'Last 30 Days';
    else label = 'Older';

    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  });

  return groups;
}

async function loadConversations() {
  const res = await fetch(`/conversations?ai=${currentAI}`);
  const conversations = await res.json();

  conversationList.innerHTML = '';

  if (conversations.length === 0) return;

  const groups = groupByDate(conversations);
  const order = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Older'];

  order.forEach(label => {
    if (!groups[label]) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'date-group';
    groupEl.textContent = label;
    conversationList.appendChild(groupEl);

    groups[label].forEach(c => {
      const item = document.createElement('div');
      item.className = 'conversation-item';
      if (c.id === currentConversationId) item.classList.add('active');
      item.dataset.id = c.id;
      const titleSpan = document.createElement('span');
      titleSpan.textContent = c.title || 'Untitled';
      item.appendChild(titleSpan);
      item.addEventListener('click', () => loadConversation(c.id));

      const editBtn = document.createElement('span');
      editBtn.className = 'edit-btn';
      editBtn.textContent = '✏';
      editBtn.title = 'Rename';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        renameConversation(item, c.id, c.title || 'Untitled');
      });
      item.appendChild(editBtn);

      conversationList.appendChild(item);
    });
  });
}

async function loadConversation(id) {
  currentConversationId = id;
  chatWindow.innerHTML = '';

  const res = await fetch(`/conversations/${id}`);
  const messages = await res.json();
  messages.forEach(m => addMessage(m.role, m.content, m.id));

  document.querySelectorAll('.conversation-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.id) === id);
  });

  input.focus();
}

async function newConversation() {
  currentConversationId = null;
  chatWindow.innerHTML = '';
  document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
  input.focus();
}

function spawnRavens(count = 4) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const raven = document.createElement('span');
      raven.className = 'flying-raven';
      raven.textContent = '🐦‍⬛';
      raven.style.top = (15 + Math.random() * 65) + 'vh';
      const duration = (5.5 + Math.random() * 2.5).toFixed(2) + 's';
      raven.style.animationDuration = duration;
      raven.style.fontSize = (0.9 + Math.random() * 0.7).toFixed(2) + 'rem';
      document.body.appendChild(raven);
      raven.addEventListener('animationend', () => raven.remove());
    }, i * 280 + Math.floor(Math.random() * 180));
  }
}

const REACTIONS = ['💀', '🔥', '🖤', '😂', '😭', '🐦‍⬛', '💋', '😊'];

function getReactions(id) {
  if (!id) return [];
  const stored = localStorage.getItem(`reactions_${id}`);
  return stored ? JSON.parse(stored) : [];
}

function saveReactions(id, reactions) {
  if (!id) return;
  localStorage.setItem(`reactions_${id}`, JSON.stringify(reactions));
}

function toggleReaction(id, emoji, chipsEl) {
  const current = getReactions(id);
  const idx = current.indexOf(emoji);
  if (idx > -1) current.splice(idx, 1);
  else current.push(emoji);
  saveReactions(id, current);
  renderChips(chipsEl, current, id);
}

function renderChips(chipsEl, reactions, id) {
  chipsEl.innerHTML = '';
  reactions.forEach(emoji => {
    const chip = document.createElement('span');
    chip.className = 'reaction-chip active';
    chip.textContent = emoji;
    chip.addEventListener('click', () => toggleReaction(id, emoji, chipsEl));
    chipsEl.appendChild(chip);
  });
}

function addMessage(role, content, id = null) {
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${role}`;
  if (id) wrapper.dataset.id = id;

  const bubble = document.createElement('div');
  bubble.classList.add('message', role);
  bubble.textContent = content;

  const chips = document.createElement('div');
  chips.className = 'reaction-chips';
  renderChips(chips, getReactions(id), id);

  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  REACTIONS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'reaction-btn';
    btn.textContent = emoji;
    btn.addEventListener('click', () => toggleReaction(id, emoji, chips));
    picker.appendChild(btn);
  });

  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'msg-action-btn';
  deleteBtn.textContent = 'delete';
  deleteBtn.addEventListener('click', () => removeMessage(wrapper, id));
  actions.appendChild(deleteBtn);

  if (role === 'assistant') {
    const regenBtn = document.createElement('button');
    regenBtn.className = 'msg-action-btn';
    regenBtn.textContent = 'regenerate';
    regenBtn.addEventListener('click', () => regenerateResponse(wrapper, id));
    actions.appendChild(regenBtn);
  }

  wrapper.appendChild(bubble);
  wrapper.appendChild(chips);
  wrapper.appendChild(picker);
  wrapper.appendChild(actions);
  chatWindow.appendChild(wrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return wrapper;
}

async function removeMessage(wrapper, id) {
  if (id) await fetch(`/messages/${id}`, { method: 'DELETE' });
  wrapper.remove();
}

async function regenerateResponse(wrapper, id) {
  const allWrappers = [...chatWindow.querySelectorAll('.message-wrapper')];
  const idx = allWrappers.indexOf(wrapper);
  const userWrapper = allWrappers.slice(0, idx).reverse().find(w => w.classList.contains('user'));
  if (!userWrapper) return;

  const userText = userWrapper.querySelector('.message').textContent;
  const userMsgId = userWrapper.dataset.id || null;

  await removeMessage(wrapper, id);

  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userText, conversationId: currentConversationId, ai: currentAI, regenerate: true }),
  });

  const data = await res.json();
  addMessage('assistant', data.reply, data.id);
}

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.dispatchEvent(new Event('submit'));
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  if (!currentConversationId) {
    const res = await fetch('/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstMessage: message, ai: currentAI }),
    });
    const data = await res.json();
    currentConversationId = data.id;
    await loadConversations();
  }

  addMessage('user', message);
  input.value = '';
  input.style.height = 'auto';
  spawnRavens(3);

  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationId: currentConversationId, ai: currentAI }),
  });

  const data = await res.json();
  addMessage('assistant', data.reply, data.assistantId);
  spawnRavens(4);
});

async function renameConversation(item, id, current) {
  const renameInput = document.createElement('input');
  renameInput.type = 'text';
  renameInput.value = current;
  renameInput.className = 'rename-input';
  item.innerHTML = '';
  item.appendChild(renameInput);
  renameInput.focus();
  renameInput.select();

  let saved = false;

  async function save() {
    if (saved) return;
    saved = true;
    const newTitle = renameInput.value.trim() || current;
    await fetch(`/conversations/${id}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    await loadConversations();
  }

  renameInput.addEventListener('blur', save);
  renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') renameInput.blur();
    if (e.key === 'Escape') { saved = true; loadConversations(); }
  });
}

async function deleteCurrentConversation() {
  if (!currentConversationId) return;
  const confirmed = confirm('Delete this conversation? This cannot be undone.');
  if (!confirmed) return;

  await fetch(`/clear/${currentConversationId}`, { method: 'POST' });
  currentConversationId = null;
  chatWindow.innerHTML = '';
  await loadConversations();
  showChat();
}
