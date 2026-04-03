'use client';

import { useMemo, useState } from 'react';

type CounterApiResponse = {
  requestHandledAt: string;
  nextServerCount: number;
  explanation: string;
};

type ClientCounterPanelProps = {
  staticStageSummary: string[];
};

export function ClientCounterPanel({ staticStageSummary }: ClientCounterPanelProps) {
  const [clientClickCount, setClientClickCount] = useState(0);
  const [serverRoundtripCount, setServerRoundtripCount] = useState<number | null>(null);
  const [routeHandlerMessage, setRouteHandlerMessage] = useState('尚未触发请求。');
  const [isRequestPending, setIsRequestPending] = useState(false);

  const hydrationStateLabel = useMemo(() => {
    return clientClickCount === 0 ? '页面已 hydration，等待第一次交互。' : '页面已被 React 接管，事件与状态更新正常工作。';
  }, [clientClickCount]);

  async function incrementServerCount() {
    setIsRequestPending(true);

    try {
      const response = await fetch('/api/counter', {
        method: 'POST',
      });

      const data = (await response.json()) as CounterApiResponse;
      setServerRoundtripCount(data.nextServerCount);
      setRouteHandlerMessage(`${data.requestHandledAt} | ${data.explanation}`);
    } finally {
      setIsRequestPending(false);
    }
  }

  return (
    <section className="card">
      <span className="code-chip">Client Component</span>
      <h2>Hydration 与交互更新</h2>
      <p className="muted">首屏显示之后，客户端脚本执行并绑定事件。接下来点击按钮只会更新浏览器中的局部状态，或发起一次 Route Handler 往返。</p>
      <ul className="meta-list">
        <li>
          <strong>clientClickCount</strong>
          <div>{clientClickCount}</div>
        </li>
        <li>
          <strong>hydrationState</strong>
          <div>{hydrationStateLabel}</div>
        </li>
        <li>
          <strong>serverRoundtripCount</strong>
          <div>{serverRoundtripCount ?? '尚未请求'}</div>
        </li>
      </ul>
      <div className="button-row">
        <button onClick={() => setClientClickCount((count) => count + 1)}>只更新客户端状态</button>
        <button className="secondary" onClick={incrementServerCount} disabled={isRequestPending}>
          {isRequestPending ? '请求中...' : '请求 Route Handler'}
        </button>
      </div>
      <div className="timeline">
        {staticStageSummary.map((stageSummary) => (
          <div className="timeline-item" key={stageSummary}>
            {stageSummary}
          </div>
        ))}
      </div>
      <p className="muted">{routeHandlerMessage}</p>
    </section>
  );
}
