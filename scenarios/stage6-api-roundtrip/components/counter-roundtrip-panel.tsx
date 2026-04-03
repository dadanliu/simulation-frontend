'use client';

import { useState } from 'react';

type CounterSnapshot = {
  requestHandledAt: string;
  nextValue: number;
};

export function CounterRoundtripPanel() {
  const [counterSnapshot, setCounterSnapshot] = useState<CounterSnapshot | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function fetchCounterSnapshot() {
    setIsPending(true);
    try {
      const response = await fetch('/api/counter', { method: 'POST' });
      const data = (await response.json()) as CounterSnapshot;
      setCounterSnapshot(data);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <button onClick={fetchCounterSnapshot} disabled={isPending}>
        {isPending ? '请求中...' : '触发请求'}
      </button>
      <p>requestHandledAt: {counterSnapshot?.requestHandledAt ?? '尚未请求'}</p>
      <p>nextValue: {counterSnapshot?.nextValue ?? 0}</p>
    </div>
  );
}
