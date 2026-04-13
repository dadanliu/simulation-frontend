async function loadServerOnlyArticleList() {
  return [
    { title: '服务端先读取数据', emphasis: '输入是请求期可访问的数据源与服务端组件逻辑。' },
    { title: '数据直接参与首屏生成', emphasis: '输出是已经带数据的首屏结果。' },
    { title: '浏览器不会拿到取数函数本身', emphasis: '浏览器只消费最终结果，不消费这段服务端读取逻辑。' },
  ];
}

export default async function RscBasicPage() {
  const serverOnlyArticleList = await loadServerOnlyArticleList();

  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">Stage 4 / RSC</span>
        <h1>服务端读取数据并参与首屏生成</h1>
        <p>
          这个场景模拟线性主链里的一个真实节点：请求进入服务端后，Server Component 先把数据准备好，再把结果拼进首屏输出。
        </p>
        <div className="info-grid">
          <div className="info-box">
            <strong>在线路位置</strong>
            <p className="subtle">首屏生成前半段</p>
          </div>
          <div className="info-box">
            <strong>输入</strong>
            <p className="subtle">请求、服务端数据、组件树</p>
          </div>
          <div className="info-box">
            <strong>输出</strong>
            <p className="subtle">已经带数据的首屏结果</p>
          </div>
        </div>
        <ul className="detail-list">
          {serverOnlyArticleList.map((article) => (
            <li key={article.title}>
              <strong>{article.title}</strong>
              <div>{article.emphasis}</div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
