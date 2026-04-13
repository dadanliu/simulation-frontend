'use client';

import { useEffect, useState } from 'react';

export function HydrationReadyPanel() {
  const [hydrationReady, setHydrationReady] = useState(false);
  const [tapCount, setTapCount] = useState(0);

  useEffect(() => {
    setHydrationReady(true);
  }, []);

  return (
    <div className="detail-list">
      <div className="info-box">
        <strong>hydrationReady</strong>
        <div>{hydrationReady ? 'true' : 'false'}</div>
      </div>
      <div className="info-box">
        <button onClick={() => setTapCount((count) => count + 1)} disabled={!hydrationReady}>
          页面接管后再点击
        </button>
        <p>tapCount: {tapCount}</p>
      </div>
    </div>
  );
}
