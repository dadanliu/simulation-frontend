type TwoTrackComparisonProps = {
  firstPaintTrack: string[];
  interactionUpdateTrack: string[];
};

export function TwoTrackComparison({ firstPaintTrack, interactionUpdateTrack }: TwoTrackComparisonProps) {
  return (
    <section className="story-card accent-card">
      <div className="story-card-header">
        <span className="code-chip">双轨对照</span>
        <h2>首屏链 vs 交互更新链</h2>
      </div>
      <p className="muted">
        这两条链是连接在一起的，但不是同一回事。首屏链解决“页面怎么第一次显示出来”，交互更新链解决“用户操作后系统怎么局部响应”。
      </p>
      <div className="track-grid">
        <div className="track-card">
          <h3>首屏链</h3>
          <div className="timeline compact-timeline">
            {firstPaintTrack.map((item) => (
              <div className="timeline-item" key={item}>{item}</div>
            ))}
          </div>
        </div>
        <div className="track-card">
          <h3>交互更新链</h3>
          <div className="timeline compact-timeline">
            {interactionUpdateTrack.map((item) => (
              <div className="timeline-item" key={item}>{item}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
