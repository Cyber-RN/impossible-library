async function chat(messages, model = 'llama3.1', temperature = 0.8) {
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { temperature },
    }),
  });

  const data = await response.json();
  return data.message.content;
}

async function getModels() {
  const response = await fetch('http://localhost:11434/api/tags');
  const data = await response.json();
  return (data.models || []).map(m => m.name);
}

export { chat, getModels };
