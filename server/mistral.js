async function chatMistral(messages, apiKey, model = 'mistral-large-latest', temperature = 0.8) {
  const clean = messages.map(({ role, content }) => ({ role, content }));
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: clean, temperature }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Mistral API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export { chatMistral };
