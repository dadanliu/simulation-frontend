export const revalidate = false;

const staticArticleList = [
  '这份列表在构建期就已经确定。',
  '适合被当作静态资源长期缓存。',
  '浏览器拿到的通常是提前产出的 HTML。',
];

export default function SsgBasicPage() {
  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">SSG</span>
        <h1>构建期生成的静态内容</h1>
        <p>这个场景强调的是“内容在 build 时就已经确定”，因此更适合发布到 CDN。</p>
        <ul className="detail-list">
          {staticArticleList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
