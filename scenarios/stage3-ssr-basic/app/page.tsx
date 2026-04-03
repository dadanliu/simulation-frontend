import { unstable_noStore as noStore } from 'next/cache';

async function loadRequestTimeSnapshot() {
  noStore();
  return {
    requestedAt: new Date().toISOString(),
    explanation: '每次刷新都会重新生成，因为这段页面依赖请求时刻。',
  };
}

export default async function SsrBasicPage() {
  const requestTimeSnapshot = await loadRequestTimeSnapshot();

  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">SSR</span>
        <h1>请求到来时生成页面</h1>
        <p>刷新页面时，这个时间会变化，说明首屏内容依赖请求发生的当下。</p>
        <ul className="detail-list">
          <li>
            <strong>requestedAt</strong>
            <div>{requestTimeSnapshot.requestedAt}</div>
          </li>
          <li>
            <strong>why dynamic</strong>
            <div>{requestTimeSnapshot.explanation}</div>
          </li>
        </ul>
      </div>
    </main>
  );
}
