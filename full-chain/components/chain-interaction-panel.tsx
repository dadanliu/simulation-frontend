'use client';

import { useEffect, useMemo, useState } from 'react';

type CounterApiResponse = {
  requestHandledAt: string;
  nextServerCount: number;
  explanation: string;
};

type ChainInteractionPanelProps = {
  browserRenderPipelineSteps: string[];
  driverSignal: number;
  driverAction: 'none' | 'hydrate' | 'local-update' | 'server-roundtrip';
  onSimulationLog?: (category: 'stage' | 'hydrate' | 'local-update' | 'server-roundtrip', message: string) => void;
};

export function ChainInteractionPanel({
  browserRenderPipelineSteps,
  driverSignal,
  driverAction,
  onSimulationLog,
}: ChainInteractionPanelProps) {
  const [hydrationReady, setHydrationReady] = useState(false);
  const [clientClickCount, setClientClickCount] = useState(0);
  const [serverRoundtripCount, setServerRoundtripCount] = useState<number | null>(null);
  const [routeHandlerMessage, setRouteHandlerMessage] = useState('尚未触发请求。');
  const [isRequestPending, setIsRequestPending] = useState(false);

  useEffect(() => {
    setHydrationReady(true);
  }, []);

  const localUpdateNarrative = useMemo(() => {
    return clientClickCount === 0
      ? '等待第一次点击：页面已经显示，但这里主要用于说明 hydration 完成后的交互起点。'
      : '点击后发生了：事件处理 -> 状态变化 -> React 重算受影响 UI -> DOM 变化 -> 浏览器重新走受影响部分的渲染流水线。';
  }, [clientClickCount]);

  async function incrementServerCount(triggerSource: 'manual' | 'driver' = 'manual') {
    setIsRequestPending(true);
    try {
      const response = await fetch('/api/counter', { method: 'POST' });
      const data = (await response.json()) as CounterApiResponse;
      setServerRoundtripCount(data.nextServerCount);
      setRouteHandlerMessage(
        `${triggerSource === 'driver' ? '[状态机触发] ' : ''}${data.requestHandledAt} | ${data.explanation}`,
      );
      onSimulationLog?.(
        'server-roundtrip',
        `${triggerSource === 'driver' ? '状态机' : '手动'}触发服务端往返 -> nextServerCount=${data.nextServerCount}`,
      );
    } finally {
      setIsRequestPending(false);
    }
  }

  useEffect(() => {
    if (driverAction === 'none') return;

    if (driverAction === 'hydrate') {
      setHydrationReady(true);
      onSimulationLog?.('hydrate', '状态机触发 hydration 完成 -> 页面进入可交互状态');
      return;
    }

    if (driverAction === 'local-update') {
      setHydrationReady(true);
      setClientClickCount((count) => {
        const next = count + 1;
        onSimulationLog?.('local-update', `状态机触发本地更新 -> clientClickCount=${next}`);
        return next;
      });
      return;
    }

    if (driverAction === 'server-roundtrip') {
      setHydrationReady(true);
      void incrementServerCount('driver');
    }
  }, [driverAction, driverSignal, onSimulationLog]);

  return (
    <section className="story-card accent-card">
      <div className="story-card-header">
        <span className="code-chip">Stage 5 + Stage 6</span>
        <h2>hydration、交互更新、请求往返</h2>
      </div>
      <div className="stats-grid">
        <div className="stat-box">
          <strong>hydrationReady</strong>
          <div>{hydrationReady ? 'true' : 'false'}</div>
        </div>
        <div className="stat-box">
          <strong>clientClickCount</strong>
          <div>{clientClickCount}</div>
        </div>
        <div className="stat-box">
          <strong>serverRoundtripCount</strong>
          <div>{serverRoundtripCount ?? '尚未请求'}</div>
        </div>
      </div>
      <p className="muted">{localUpdateNarrative}</p>
      <div className="button-row">
        <button
          onClick={() => {
            const next = clientClickCount + 1;
            setClientClickCount(next);
            onSimulationLog?.('local-update', `手动触发本地更新 -> clientClickCount=${next}`);
          }}
          disabled={!hydrationReady}
        >
          只更新客户端状态
        </button>
        <button className="secondary" onClick={() => incrementServerCount('manual')} disabled={!hydrationReady || isRequestPending}>
          {isRequestPending ? '请求中...' : '请求 Route Handler'}
        </button>
      </div>
      <div className="story-subsection">
        <h3>本地更新后，浏览器后续仍会涉及的渲染流水线</h3>
        <div className="timeline">
          {browserRenderPipelineSteps.map((step) => (
            <div className="timeline-item" key={step}>{step}</div>
          ))}
        </div>
      </div>
      <div className="story-subsection">
        <h3>请求往返观察</h3>
        <p className="muted">{routeHandlerMessage}</p>
      </div>
    </section>
  );
}
