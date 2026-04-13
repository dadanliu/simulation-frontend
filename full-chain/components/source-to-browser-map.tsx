import { MappingTriplet } from '@/lib/chain-data';

export function SourceToBrowserMap({ mappings }: { mappings: MappingTriplet[] }) {
  return (
    <section className="story-card accent-card">
      <div className="story-card-header">
        <span className="code-chip">核心映射</span>
        <h2>源码片段 → 构建产物 → 浏览器结果</h2>
      </div>
      <p className="muted">
        这块是整页里最关键的桥：把“编辑器里看到的规则”直接对照到“构建后留下的东西”和“浏览器里最终发生的结果”。
      </p>
      <div className="mapping-list">
        {mappings.map((mapping) => (
          <article key={mapping.title} className="mapping-card">
            <h3>{mapping.title}</h3>
            <div className="mapping-grid">
              <div>
                <span className="mapping-label">源码片段</span>
                <pre>{mapping.sourceSnippet}</pre>
              </div>
              <div>
                <span className="mapping-label">构建后留下什么</span>
                <p>{mapping.buildArtifact}</p>
              </div>
              <div>
                <span className="mapping-label">浏览器里最后发生什么</span>
                <p>{mapping.browserResult}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
