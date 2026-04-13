import { ChainStage } from '@/lib/chain-data';

export function LinearStageCard({ stage }: { stage: ChainStage }) {
  return (
    <section className="story-card">
      <div className="story-card-header">
        <span className="code-chip">{stage.phase}</span>
        <h2>{stage.title}</h2>
      </div>
      <p className="question-line">问题：{stage.keyQuestion}</p>
      <p className="muted">{stage.explanation}</p>
      <div className="io-grid">
        <div>
          <h3>输入</h3>
          <ul className="bullet-list">
            {stage.input.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>输出</h3>
          <ul className="bullet-list">
            {stage.output.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
