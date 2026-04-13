import { HydrationReadyPanel } from '@/components/hydration-ready-panel';

export default function HydrationBasicPage() {
  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">Stage 5 / Hydration</span>
        <h1>先能看，再能点</h1>
        <p>
          这个场景模拟线性主链里的 hydration 节点：浏览器先把页面显示出来，但要等客户端脚本执行并完成接管，交互才真正生效。
        </p>
        <div className="info-grid">
          <div className="info-box">
            <strong>在线路位置</strong>
            <p className="subtle">可见首屏进入可交互页面的过渡点</p>
          </div>
          <div className="info-box">
            <strong>输入</strong>
            <p className="subtle">首屏 HTML、客户端 JS、React 运行时</p>
          </div>
          <div className="info-box">
            <strong>输出</strong>
            <p className="subtle">已完成事件绑定的页面</p>
          </div>
        </div>
        <HydrationReadyPanel />
      </div>
    </main>
  );
}
