import { loadHomepageServerSnapshot } from '@/lib/homepage-data';

export async function ServerTimePanel() {
  const homepageServerSnapshot = await loadHomepageServerSnapshot();

  return (
    <section className="card">
      <span className="code-chip">Server Component</span>
      <h2>首屏服务端数据</h2>
      <p className="muted">请求进入 Node runtime 后，这块数据在服务端生成，再参与首屏 HTML 输出。</p>
      <ul className="meta-list">
        <li>
          <strong>serverRenderedAt</strong>
          <div>{homepageServerSnapshot.serverRenderedAt}</div>
        </li>
        <li>
          <strong>renderingMode</strong>
          <div>{homepageServerSnapshot.renderingMode}</div>
        </li>
        <li>
          <strong>why RSC stays server-side</strong>
          <div>{homepageServerSnapshot.rscExplanation}</div>
        </li>
      </ul>
    </section>
  );
}
