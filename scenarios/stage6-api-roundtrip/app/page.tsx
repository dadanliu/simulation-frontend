import { CounterRoundtripPanel } from '@/components/counter-roundtrip-panel';

export default function ApiRoundtripPage() {
  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">Route Handler</span>
        <h1>浏览器请求往返</h1>
        <p>这个场景聚焦一次完整的请求路径：浏览器发起 fetch，请求进入 Route Handler，再把响应数据写回 React 状态。</p>
        <CounterRoundtripPanel />
      </div>
    </main>
  );
}
