import { CounterRoundtripPanel } from '@/components/counter-roundtrip-panel';

export default function ApiRoundtripPage() {
  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">Stage 6 / Route Handler</span>
        <h1>浏览器到服务端的一次请求往返</h1>
        <p>
          这个场景聚焦线性主链里的“请求往返更新节点”：不是所有更新都只发生在本地状态里，有些更新需要走 fetch、服务端处理，再回到 UI。
        </p>
        <div className="info-grid">
          <div className="info-box">
            <strong>在线路位置</strong>
            <p className="subtle">交互与增量更新阶段</p>
          </div>
          <div className="info-box">
            <strong>输入</strong>
            <p className="subtle">点击事件、浏览器 fetch、服务端处理逻辑</p>
          </div>
          <div className="info-box">
            <strong>输出</strong>
            <p className="subtle">JSON 响应、更新后的 React 状态与页面</p>
          </div>
        </div>
        <CounterRoundtripPanel />
      </div>
    </main>
  );
}
