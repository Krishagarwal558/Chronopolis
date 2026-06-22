async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }

  return response.json();
}

export function getState() {
  return requestJson('/api/state');
}

export function tickTown(payload = {}) {
  return requestJson('/api/tick', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function interactNPC(npcName, playerQuestion) {
  return requestJson('/api/interact', {
    method: 'POST',
    body: JSON.stringify({
      npcName,
      playerQuestion
    })
  });
}

export function getCase() {
  return requestJson('/api/case');
}
