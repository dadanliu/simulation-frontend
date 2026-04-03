import { BuildInfoPanel } from '@/components/build-info-panel';
import { ClientCounterPanel } from '@/components/client-counter-panel';
import { ServerTimePanel } from '@/components/server-time-panel';
import { loadStaticStageSummary } from '@/lib/homepage-data';

export default async function HomePage() {
  const staticStageSummary = await loadStaticStageSummary();

  return (
    <main>
      <section className="hero">
        <span className="code-chip">Full Chain Demo</span>
        <h1>从源码到像素的 Next.js 主链路</h1>
        <p>
          这个主项目把文档里的统一主动作落成一个最小闭环：首次打开首页时先由服务端生成首屏，再由浏览器下载客户端脚本完成 hydration，最后通过本地状态更新与 Route Handler 请求展示交互链路。
        </p>
      </section>
      <section className="grid">
        <ServerTimePanel />
        <BuildInfoPanel />
        <ClientCounterPanel staticStageSummary={staticStageSummary} />
      </section>
    </main>
  );
}
