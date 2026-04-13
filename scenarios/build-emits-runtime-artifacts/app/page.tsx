const buildArtifactRows = [
  ['HTML', '首屏可见结构，帮助浏览器尽快开始解析和显示。'],
  ['CSS', '参与样式计算、布局、绘制与合成。'],
  ['Client JS', '让页面完成 hydration，并承载后续交互逻辑。'],
  ['Server Logic', '处理必须保留在服务端执行的逻辑。'],
  ['Static Assets', '图片、字体等资源会作为可交付文件参与请求。'],
];

export default function BuildArtifactsPage() {
  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">Stage 2 → Stage 3</span>
        <h1>同一份源码会被拆成哪些产物</h1>
        <p>
          这个场景不强调交互，而是把线性主链中“构建处理完成后，到底交付了什么”讲清楚。重点是职责拆分，不是术语展示。
        </p>
        <div className="info-grid">
          <div className="info-box">
            <strong>在线路位置</strong>
            <p className="subtle">构建处理结束，准备进入资源交付</p>
          </div>
          <div className="info-box">
            <strong>输入</strong>
            <p className="subtle">源码、依赖图、静态资源</p>
          </div>
          <div className="info-box">
            <strong>输出</strong>
            <p className="subtle">HTML / CSS / JS / 服务端逻辑 / 静态资源</p>
          </div>
        </div>
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
