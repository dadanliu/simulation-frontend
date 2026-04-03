import { unstable_noStore as noStore } from 'next/cache';

export type HomepageServerSnapshot = {
  serverRenderedAt: string;
  visitorMessage: string;
  renderingMode: 'SSR';
  rscExplanation: string;
};

const homepageNarrative = [
  '源码先描述结构、状态和交互规则。',
  '请求到来后，Server Component 在服务端生成首屏所需数据。',
  '浏览器先显示 HTML，再等待客户端脚本完成 hydration。',
];

export async function loadHomepageServerSnapshot(): Promise<HomepageServerSnapshot> {
  noStore();

  await new Promise((resolve) => setTimeout(resolve, 80));

  return {
    serverRenderedAt: new Date().toISOString(),
    visitorMessage: homepageNarrative.join(' '),
    renderingMode: 'SSR',
    rscExplanation: '这个对象由服务端组件直接读取，不会因为读取本身进入浏览器 bundle。',
  };
}

export async function loadStaticStageSummary(): Promise<string[]> {
  return [
    'Stage 01: 编辑器中写下 App Router + TypeScript 源码。',
    'Stage 05: CI 里执行 pnpm install 与 next build。',
    'Stage 09: 浏览器解析 HTML/CSS 并画出首屏像素。',
  ];
}
