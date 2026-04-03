import { ClientStatePanel } from '@/components/client-state-panel';

export default function CsrBasicPage() {
  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">CSR</span>
        <h1>浏览器中的状态更新</h1>
        <p>这个页面主要关注 hydration 之后的客户端更新，不强调服务端重新生成。</p>
        <ClientStatePanel />
      </div>
    </main>
  );
}
