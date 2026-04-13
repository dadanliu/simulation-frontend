export const revalidate = false;

const staticArticleList = [
  '这份列表在构建期就已经确定。',
  '它更适合被当作静态资源长期缓存和分发。',
  '这里强调的是“先 build，再交付”，而不是“请求来了再算”。',
];

export default function SsgBasicPage() {
  return (
    <main className="page-shell">
      <div className="page-card">
        <span className="badge">Stage 2 / SSG</span>
        <h1>构建期提前生成静态结果</h1>
        <p>
          这个场景把 SSG 放回线性主链里看：它属于构建处理阶段，重点是构建期就把结果准备好，后续更适合走静态分发。
        </p>
        <div className="info-grid">
          <div className="info-box">
            <strong>在线路位置</strong>
            <p className="subtle">构建处理阶段</p>
          </div>
          <div className="info-box">
            <strong>输入</strong>
            <p className="subtle">构建期已知数据、页面模板</p>
          </div>
          <div className="info-box">
            <strong>输出</strong>
            <p className="subtle">提前产出的静态页面结果</p>
          </div>
        </div>
        <ul className="detail-list">
          {staticArticleList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
