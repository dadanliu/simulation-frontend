'use client';

import { useMemo, useState } from 'react';

export function ClientStatePanel() {
  const [clientClickCount, setClientClickCount] = useState(0);
  const clientPhaseDescription = useMemo(() => {
    return clientClickCount === 0
      ? '按钮还未触发更新。'
      : '这次更新只发生在浏览器中，不需要服务端重新生成整个页面。';
  }, [clientClickCount]);

  return (
    <div>
      <p>clientClickCount: {clientClickCount}</p>
      <button onClick={() => setClientClickCount((count) => count + 1)}>增加本地计数</button>
      <p>{clientPhaseDescription}</p>
    </div>
  );
}
