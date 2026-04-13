import { unstable_noStore as noStore } from 'next/cache';

async function loadRequestTimeSnapshot() {
  noStore();
  return {
    requestedAt: new Date().toISOString(),
    explanation: '每次刷新都会重新生成，因为这段页面依赖请求发生的当下。',
  };
}

export default async function SsrBasicPage() {
  const requestTimeSnapshot = await loadRequestTimeSnapshot();

  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">Stage 4 / SSR</span>
        <h1>请求到来时重新生成首屏</h1>
        <p>
          这个场景把 SSR 放回线性主链里看：它不是目录主角，而是首屏生成阶段的一种实现方式。关键特征是结果依赖本次请求当下。
        </p>
        <div className="info-grid">
          <div className="info-box">
            <strong>在线路位置</strong>
            <p className="subtle">首屏生成节点</p>
          </div>
          <div className="info-box">
            <strong>输入</strong>
            <p className="subtle">当前请求时刻、服务端逻辑</p>
          </div>
          <div className="info-box">
            <strong>输出</strong>
            <p className="subtle">与本次请求绑定的 HTML 结果</p>
          </div>
        </div>
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
