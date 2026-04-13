'use client';

import { useMemo, useState } from 'react';
import { simulatorSteps } from '@/lib/chain-data';
import { ChainInteractionPanel } from '@/components/chain-interaction-panel';
import { ChainSimulator } from '@/components/chain-simulator';

type LogCategory = 'all' | 'stage' | 'hydrate' | 'local-update' | 'server-roundtrip';

type LogEntry = {
  id: number;
  message: string;
  category: Exclude<LogCategory, 'all'>;
};

function formatNow() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

const categoryLabels: Record<LogCategory, string> = {
  all: '全部',
  stage: '阶段切换',
  hydrate: 'Hydration',
  'local-update': '本地更新',
  'server-roundtrip': '服务端往返',
};

export function FullChainSimulatorSection({ browserRenderPipelineSteps }: { browserRenderPipelineSteps: string[] }) {
  const [driverAction, setDriverAction] = useState<'none' | 'hydrate' | 'local-update' | 'server-roundtrip'>('none');
  const [driverSignal, setDriverSignal] = useState(0);
  const [activeLogCategory, setActiveLogCategory] = useState<LogCategory>('all');
  const [logEntries, setLogEntries] = useState<LogEntry[]>([
    {
      id: 1,
      category: 'stage',
      message: `[${formatNow()}] 模拟器已就绪：等待你切换阶段或触发事件。`,
    },
  ]);

  function appendLog(category: Exclude<LogCategory, 'all'>, message: string) {
    setLogEntries((entries) => [
      {
        id: entries.length === 0 ? 1 : entries[0].id + 1,
        category,
        message: `[${formatNow()}] ${message}`,
      },
      ...entries,
    ].slice(0, 20));
  }

  const filteredLogEntries = useMemo(() => {
    if (activeLogCategory === 'all') return logEntries;
    return logEntries.filter((entry) => entry.category === activeLogCategory);
  }, [activeLogCategory, logEntries]);

  return (
    <>
      <ChainSimulator
        steps={simulatorSteps}
        onDriverAction={({ stepId, action }) => {
          setDriverAction(action);
          setDriverSignal((count) => count + 1);

          const actionLabelMap: Record<typeof action, string> = {
            none: '切换到说明节点',
            hydrate: '触发 hydration 完成',
            'local-update': '触发本地点击更新',
            'server-roundtrip': '触发服务端请求往返',
          };

          appendLog('stage', `${actionLabelMap[action]} -> 当前阶段切到 ${stepId}`);
        }}
      />
      <ChainInteractionPanel
        browserRenderPipelineSteps={browserRenderPipelineSteps}
        driverAction={driverAction}
        driverSignal={driverSignal}
        onSimulationLog={appendLog}
      />
      <section className="story-card">
        <div className="story-card-header">
          <span className="code-chip">运行日志</span>
          <h2>事件轨迹</h2>
        </div>
        <p className="muted">
          这里记录状态机和真实交互面板之间发生过的推进动作。你可以按类别过滤，只看你当前关心的那一段链路。
        </p>
        <div className="log-filter-row">
          {(Object.keys(categoryLabels) as LogCategory[]).map((category) => {
            const isActive = activeLogCategory === category;
            return (
              <button
                key={category}
                type="button"
                className={isActive ? 'log-filter-button active' : 'log-filter-button'}
                onClick={() => setActiveLogCategory(category)}
              >
                {categoryLabels[category]}
              </button>
            );
          })}
        </div>
        <div className="log-list">
          {filteredLogEntries.map((entry) => (
            <div key={entry.id} className="log-item">
              <span className={`log-tag ${entry.category}`}>{categoryLabels[entry.category]}</span>
              <div>{entry.message}</div>
            </div>
          ))}
          {filteredLogEntries.length === 0 ? (
            <div className="log-empty">当前过滤条件下还没有日志。</div>
          ) : null}
        </div>
      </section>
    </>
  );
}
