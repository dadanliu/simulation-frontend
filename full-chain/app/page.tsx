import { FullChainSimulatorSection } from '@/components/full-chain-simulator-section';
import { LinearStageCard } from '@/components/linear-stage-card';
import { SourceToBrowserMap } from '@/components/source-to-browser-map';
import { TwoTrackComparison } from '@/components/two-track-comparison';
import {
  artifactDeliveryPath,
  browserRenderPipelineSteps,
  buildTransformationSteps,
  createLinearChainStages,
  firstPaintTrack,
  interactionUpdateNarrative,
  interactionUpdateTrack,
  sourceCodeMentalModel,
  sourceDescriptionSummary,
  sourceToBrowserMappings,
} from '@/lib/chain-data';
import { loadHomepageServerSnapshot } from '@/lib/homepage-data';

export default async function HomePage() {
  const homepageServerSnapshot = await loadHomepageServerSnapshot();
  const linearChainStages = createLinearChainStages();

  return (
    <main>
      <section className="hero">
        <span className="code-chip">Linear Full Chain</span>
        <h1>同一个页面，如何从源码一路变成屏幕上的响应</h1>
        <p>
          这不是术语索引页，而是一张按真实时间顺序展开的单页教学图。你可以把它理解成同一个页面的一生：先在编辑器里被描述，再经过构建和交付，进入浏览器被解析成首屏，随后完成 hydration，最后在用户点击后触发局部更新或请求往返。
        </p>
      </section>

      <section className="overview-card">
        <div>
          <span className="code-chip">总链路</span>
          <h2>源码 → 构建 → 交付 → 解析 → 首屏 → hydration → 交互更新</h2>
        </div>
        <div className="overview-flow">
          {linearChainStages.map((stage) => (
            <div key={stage.id} className="overview-step">
              <strong>{stage.phase}</strong>
              <span>{stage.title}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="story-layout">
        <section className="story-card accent-card">
          <div className="story-card-header">
            <span className="code-chip">先立一个总心智模型</span>
            <h2>你真正想看清的是哪条线</h2>
          </div>
          <ul className="bullet-list">
            {sourceCodeMentalModel.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {linearChainStages.map((stage) => (
          <LinearStageCard key={stage.id} stage={stage} />
        ))}


        <SourceToBrowserMap mappings={sourceToBrowserMappings} />

        <TwoTrackComparison firstPaintTrack={firstPaintTrack} interactionUpdateTrack={interactionUpdateTrack} />


        <section className="story-card">
          <div className="story-card-header">
            <span className="code-chip">Stage 1 展开</span>
            <h2>源码到底在描述什么</h2>
          </div>
          <ul className="bullet-list">
            {sourceDescriptionSummary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="story-card">
          <div className="story-card-header">
            <span className="code-chip">Stage 2 展开</span>
            <h2>构建工具到底做了什么</h2>
          </div>
          <ul className="bullet-list">
            {buildTransformationSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="story-card">
          <div className="story-card-header">
            <span className="code-chip">Stage 3 展开</span>
            <h2>交付给浏览器的是哪些资源</h2>
          </div>
          <div className="timeline">
            {artifactDeliveryPath.map((item) => (
              <div className="timeline-item" key={item}>{item}</div>
            ))}
          </div>
        </section>

        <section className="story-card">
          <div className="story-card-header">
            <span className="code-chip">Stage 4 展开</span>
            <h2>字节如何进入浏览器渲染流水线</h2>
          </div>
          <ul className="meta-list">
            <li>
              <strong>serverRenderedAt</strong>
              <div>{homepageServerSnapshot.serverRenderedAt}</div>
            </li>
            <li>
              <strong>renderingMode</strong>
              <div>{homepageServerSnapshot.renderingMode}</div>
            </li>
            <li>
              <strong>server-side explanation</strong>
              <div>{homepageServerSnapshot.rscExplanation}</div>
            </li>
          </ul>
          <div className="timeline">
            {browserRenderPipelineSteps.map((item) => (
              <div className="timeline-item" key={item}>{item}</div>
            ))}
          </div>
        </section>

        <section className="story-card">
          <div className="story-card-header">
            <span className="code-chip">Stage 6 展开</span>
            <h2>点击之后的更新链</h2>
          </div>
          <div className="timeline">
            {interactionUpdateNarrative.map((item) => (
              <div className="timeline-item" key={item}>{item}</div>
            ))}
          </div>
        </section>

        <FullChainSimulatorSection browserRenderPipelineSteps={browserRenderPipelineSteps} />
      </section>
    </main>
  );
}
