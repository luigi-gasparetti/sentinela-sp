import { useEffect, useState } from 'react';
import type { HealthResponse } from '@sentinela/shared';

export function App() {
  const [api, setApi] = useState<'carregando' | 'ok' | 'erro'>('carregando');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((body) => setApi(body.status === 'ok' ? 'ok' : 'erro'))
      .catch(() => setApi('erro'));
  }, []);

  return (
    <main>
      <h1>Sentinela SP</h1>
      <p>API: {api}</p>
    </main>
  );
}
