const buildArtifactRows = [
  ['HTML', '首屏可见结构，帮助浏览器尽快显示页面'],
  ['CSS', '参与样式计算、布局、绘制与合成'],
  ['Client JS', '让页面完成 hydration 并处理交互'],
  ['RSC Payload', '承载服务端组件计算结果，用于服务端到客户端的边界传递'],
  ['Node SSR Output', '处理必须在请求期计算的动态逻辑'],
];

export default function BuildArtifactsPage() {
  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">Build Artifacts</span>
        <h1>源码拆成哪些产物</h1>
        <p>这个页面不强调运行时交互，而是把同一个 Next.js 项目在 build 后拆出的产物职责排清楚。</p>
        <ul className="detail-list">
          {buildArtifactRows.map(([artifactName, artifactRole]) => (
            <li key={artifactName}>
              <strong>{artifactName}</strong>
              <div>{artifactRole}</div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
