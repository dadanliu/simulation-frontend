'use client';

import { useMemo, useState } from 'react';

export function ClientStatePanel() {
  const [clientClickCount, setClientClickCount] = useState(0);
  const clientPhaseDescription = useMemo(() => {
    return clientClickCount === 0
      ? '按钮还未触发更新。'
      : '这次更新发生在浏览器内：事件处理 -> 状态变化 -> React 重算 -> 局部 DOM 更新。';
  }, [clientClickCount]);

  return (
    <div className="detail-list">
      <div className="info-box">
        <strong>clientClickCount</strong>
        <div>{clientClickCount}</div>
      </div>
      <div className="info-box">
        <button onClick={() => setClientClickCount((count) => count + 1)}>增加本地计数</button>
        <p>{clientPhaseDescription}</p>
      </div>
    </div>
  );
}
