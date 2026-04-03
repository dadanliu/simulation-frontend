import { HydrationReadyPanel } from '@/components/hydration-ready-panel';

export default function HydrationBasicPage() {
  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">Hydration</span>
        <h1>先显示，再绑定交互</h1>
        <p>页面首屏可以先显示出来，但只有客户端脚本执行后，按钮才真正由 React 接管。</p>
        <HydrationReadyPanel />
      </div>
    </main>
  );
}
