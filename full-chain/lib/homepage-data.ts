import { unstable_noStore as noStore } from 'next/cache';

export type HomepageServerSnapshot = {
  serverRenderedAt: string;
  renderingMode: 'SSR';
  rscExplanation: string;
};

export async function loadHomepageServerSnapshot(): Promise<HomepageServerSnapshot> {
  noStore();

  await new Promise((resolve) => setTimeout(resolve, 80));

  return {
    serverRenderedAt: new Date().toISOString(),
    renderingMode: 'SSR',
    rscExplanation: '这段数据在服务端组件中读取并参与首屏生成，浏览器拿到的是结果，而不是服务端取数函数本身。',
  };
}
