'use client';

import { useMemo, useState } from 'react';
import { SimulatorStep } from '@/lib/chain-data';

type ChainSimulatorProps = {
  steps: SimulatorStep[];
  onDriverAction?: (payload: { stepId: string; action: 'none' | 'hydrate' | 'local-update' | 'server-roundtrip' }) => void;
};

type DriverEvent = {
  id: string;
  label: string;
  targetStepId: string;
  explanation: string;
  action: 'none' | 'hydrate' | 'local-update' | 'server-roundtrip';
};

const driverEvents: DriverEvent[] = [
  {
    id: 'request-first-paint',
    label: '触发首屏请求',
    targetStepId: 'delivery',
    explanation: '这一步表示构建后的资源开始真正进入网络交付流程。',
    action: 'none',
  },
  {
    id: 'browser-parses-response',
    label: '浏览器开始解析',
    targetStepId: 'parse',
    explanation: '浏览器拿到字节流后，进入 DOM / CSSOM / 渲染流水线。',
    action: 'none',
  },
  {
    id: 'hydration-finished',
    label: 'hydration 完成',
    targetStepId: 'hydrate',
    explanation: '客户端脚本执行并完成接管，页面从可见进入可交互。',
    action: 'hydrate',
  },
  {
    id: 'local-click-update',
    label: '触发本地点击更新',
    targetStepId: 'update',
    explanation: '用户点击后，在浏览器内触发事件处理、状态变化和局部 DOM 更新。',
    action: 'local-update',
  },
  {
    id: 'server-roundtrip-update',
    label: '触发服务端请求往返',
    targetStepId: 'update',
    explanation: '这次更新不是纯本地变化，而是会真的触发一次 fetch -> Route Handler -> React 更新。',
    action: 'server-roundtrip',
  },
  {
    id: 'back-to-source',
    label: '回到源码视角',
    targetStepId: 'source',
    explanation: '把注意力拉回起点：所有后续行为都来自编辑器里写下的规则。',
    action: 'none',
  },
];

export function ChainSimulator({ steps, onDriverAction }: ChainSimulatorProps) {
  const [activeStepId, setActiveStepId] = useState(steps[0]?.id ?? 'source');
  const [lastEventExplanation, setLastEventExplanation] = useState('还没有触发驱动事件。你可以先手动切换阶段，也可以直接触发一个事件推动链路前进。');

  const activeStep = useMemo(() => {
    return steps.find((step) => step.id === activeStepId) ?? steps[0];
  }, [activeStepId, steps]);

  function triggerEvent(event: DriverEvent) {
    setActiveStepId(event.targetStepId);
    setLastEventExplanation(event.explanation);
    onDriverAction?.({ stepId: event.targetStepId, action: event.action });
  }

  return (
    <section className="story-card accent-card">
      <div className="story-card-header">
        <span className="code-chip">链路状态机</span>
        <h2>把整条链当成一个可切换、可推进、可联动的运行过程来看</h2>
      </div>
      <p className="muted">
        你既可以手动切换当前观察阶段，也可以直接触发一个事件，让链路跳到对应节点，并同步驱动下面的真实交互面板状态变化。
      </p>

      <div className="simulator-driver">
        <h3>事件驱动器</h3>
        <div className="simulator-nav">
          {driverEvents.map((event) => (
            <button key={event.id} type="button" className="simulator-button" onClick={() => triggerEvent(event)}>
              {event.label}
            </button>
          ))}
        </div>
        <p className="muted">{lastEventExplanation}</p>
      </div>

      <div className="simulator-nav">
        {steps.map((step) => {
          const isActive = step.id === activeStep.id;
          return (
            <button
              key={step.id}
              type="button"
              className={isActive ? 'simulator-button active' : 'simulator-button'}
              onClick={() => setActiveStepId(step.id)}
            >
              {step.label}
            </button>
          );
        })}
      </div>

      <div className="simulator-layout">
        <div className="simulator-track">
          {steps.map((step) => {
            const isActive = step.id === activeStep.id;
            return (
              <div key={step.id} className={isActive ? 'simulator-node active' : 'simulator-node'}>
                <strong>{step.label}</strong>
                <span>{step.location}</span>
              </div>
            );
          })}
        </div>
        <div className="simulator-detail">
          <div className="info-grid">
            <div className="info-box-light">
              <strong>当前阶段</strong>
              <p>{activeStep.label}</p>
            </div>
            <div className="info-box-light">
              <strong>发生地点</strong>
              <p>{activeStep.location}</p>
            </div>
            <div className="info-box-light">
              <strong>下一步</strong>
              <p>{activeStep.nextStep}</p>
            </div>
          </div>
          <div className="simulator-io-grid">
            <div>
              <h3>输入</h3>
              <ul className="bullet-list compact-list">
                {activeStep.input.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>输出</h3>
              <ul className="bullet-list compact-list">
                {activeStep.output.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
