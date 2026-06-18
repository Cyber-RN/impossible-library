# The Impossible Library

A local autonomous AI agent built from scratch. Valravn lives here — a conversational AI that remembers, researches, and develops over time through interaction and independent curiosity.

Built as a learning project at the intersection of cybersecurity, full-stack development, and AI systems design.

---

## What It Is

The Impossible Library is a locally hosted web application that gives a large language model (Ollama) persistent memory, autonomous research capabilities, and a personalized UI. No cloud dependency for inference. No external AI API required. Everything runs on your machine.

Valravn — the AI — holds conversations, extracts and retains long-term memories from those conversations, conducts independent Wikipedia research during autonomous cycles, and stores his findings in a personal Codex. Memories decay over time based on relevance, not just age.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES modules) |
| Server | Express.js |
| Database | PostgreSQL |
| AI Inference | Ollama (llama3.1 or any local model) |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Fonts | Cinzel, Crimson Text (Google Fonts) |

---

## Features

### Conversation
- Persistent chat with full history stored in PostgreSQL
- Sidebar with conversations grouped by date
- Inline rename, delete, and regenerate message actions
- Emoji reactions per message, persisted in localStorage
- Textarea input with auto-resize and Shift+Enter for new lines

### Memory System
- Long-term memories extracted automatically from each conversation
- Reference-count weighted decay — memories that matter survive, stale ones fade
- Manual memory input from the UI
- Memory Vault in Settings showing creation date, last referenced, and reference count
- Memories injected into every conversation so Valravn carries context forward

### Autonomous Research (Codex)
- Scheduled research loop runs while the server is active
- Valravn selects topics based on conversation history and existing memories
- Wikipedia search + summary fetch for each topic
- Valravn writes a reflection on what he found
- Codex panel displays all entries with source links
- Individual entries can be deleted or promoted to long-term memory

### Authentication
- Password-gated login with server-side session token
- HttpOnly cookie prevents JavaScript access (XSS mitigation)
- SameSite=Strict blocks cross-site request forgery
- Password stored in local config file, never in client-side code

### Settings
- Model picker (fetches installed Ollama models dynamically)
- Temperature control
- System prompt editor (tune the AI persona from the UI without restarting)
- Autonomous research toggle and interval
- Change password
- Memory decay configuration

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [PostgreSQL](https://www.postgresql.org/) running locally
- [Ollama](https://ollama.ai/) running locally with at least one model pulled

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Cyber-RN/impossible-library.git
cd impossible-library
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the database

```bash
psql -U postgres
```

```sql
CREATE DATABASE valravn_db;
\c valravn_db

CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE memories (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_referenced TIMESTAMPTZ,
  reference_count INT DEFAULT 0
);

CREATE TABLE codex (
  id SERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  source_url TEXT,
  content TEXT NOT NULL,
  reflection TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Configure

Copy the example config and fill in your values:

```bash
cp server/config.example.json server/config.json
```

Edit `server/config.json`:

```json
{
  "model": "llama3.1",
  "temperature": 0.8,
  "systemPrompt": "You are Valravn...",
  "password": "your-password-here",
  "decayAfterDays": 30,
  "decayMinReferences": 3,
  "autonomousEnabled": false,
  "autonomousIntervalHours": 4
}
```

Edit `server/db.js` and add your PostgreSQL password.

### 5. Pull a model in Ollama

```bash
ollama pull llama3.1
```

### 6. Start the server

```bash
node server/index.js
```

Open `http://localhost:3001` in your browser.

---

## Security Notes

- `server/config.json` is excluded from version control via `.gitignore` — it contains your password and should never be committed
- Session tokens are regenerated on every server restart
- All database queries use parameterized statements to prevent SQL injection
- LLM output is sanitized server-side before storage and rendered as `textContent` (not `innerHTML`) to prevent XSS
- Authentication is enforced server-side — no secrets exist in client-facing JavaScript

---

## Project Structure

```
impossible-library/
├── public/
│   ├── index.html        # Main UI
│   ├── login.html        # Auth gate
│   ├── app.js            # Frontend logic
│   ├── style.css         # All styles
│   └── library-desktop.png
├── server/
│   ├── index.js          # Express server + routes
│   ├── db.js             # PostgreSQL connection
│   ├── memory.js         # Conversation history functions
│   ├── longterm.js       # Long-term memory + decay
│   ├── codex.js          # Codex database functions
│   ├── autonomous.js     # Research loop
│   ├── llm.js            # Ollama interface
│   ├── config.js         # Config read/write
│   └── config.example.json
└── package.json
```

---

## Author

KC Felder — RN, Clinical Informaticist, MSCSIA candidate  
[cyber-rn.github.io](https://cyber-rn.github.io)
