import { createBuildMetadata } from '@/lib/build-metadata';

export function BuildInfoPanel() {
  const buildMetadata = createBuildMetadata();

  return (
    <section className="card">
      <span className="code-chip">Build / Delivery</span>
      <h2>构建与分发</h2>
      <p className="muted">这里展示的是构建期与部署期语义：哪些产物适合进 CDN，哪些逻辑留在 Node SSR 服务。</p>
      <ul className="meta-list">
        <li>
          <strong>buildLabel</strong>
          <div>{buildMetadata.buildLabel}</div>
        </li>
        <li>
          <strong>generatedAt</strong>
          <div>{buildMetadata.generatedAt}</div>
        </li>
        <li>
          <strong>deliveryPath</strong>
          <div>{buildMetadata.deliveryPath.join(' -> ')}</div>
        </li>
      </ul>
    </section>
  );
}
