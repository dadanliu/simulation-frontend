async function loadServerOnlyArticleList() {
  return [
    { title: 'Server Component 只在服务端执行', emphasis: '取数逻辑可以直接访问服务端资源。' },
    { title: '结果参与首屏生成', emphasis: '浏览器拿到的是结果，而不是取数源码。' },
    { title: '客户端不会收到这段函数本身', emphasis: '因此它天然适合承载首屏数据拼装。' },
  ];
}

export default async function RscBasicPage() {
  const serverOnlyArticleList = await loadServerOnlyArticleList();

  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">Server Component</span>
        <h1>RSC: 服务端直接取数</h1>
        <p>这个页面本身就是服务端组件。列表数据在服务端准备好，再参与 HTML 输出。</p>
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
