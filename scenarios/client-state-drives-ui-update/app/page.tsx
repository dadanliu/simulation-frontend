import { ClientStatePanel } from '@/components/client-state-panel';

export default function CsrBasicPage() {
  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">Stage 6 / CSR</span>
        <h1>浏览器中的本地状态更新</h1>
        <p>
          这个场景只聚焦线性主链后半段：hydration 完成后，用户点击如何在浏览器内触发状态变化、局部 UI 重算和 DOM 更新。
        </p>
        <div className="info-grid">
          <div className="info-box">
            <strong>在线路位置</strong>
            <p className="subtle">交互与增量更新阶段</p>
          </div>
          <div className="info-box">
            <strong>输入</strong>
            <p className="subtle">点击事件、当前本地状态</p>
          </div>
          <div className="info-box">
            <strong>输出</strong>
            <p className="subtle">更新后的状态和局部 DOM</p>
          </div>
        </div>
        <ClientStatePanel />
      </div>
    </main>
  );
}
