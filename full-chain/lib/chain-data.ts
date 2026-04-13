export type ChainStage = {
  id: string;
  title: string;
  phase: string;
  input: string[];
  output: string[];
  explanation: string;
  keyQuestion: string;
};

export type MappingTriplet = {
  title: string;
  sourceSnippet: string;
  buildArtifact: string;
  browserResult: string;
};

export const sourceDescriptionSummary = [
  '状态：决定当前 UI 应该显示什么数据。',
  '结构：组件树和 JSX 描述页面节点关系。',
  '样式：CSS 规则决定颜色、尺寸、布局和层级。',
  '交互：事件处理函数描述点击后应该发生什么。',
];

export const sourceCodeMentalModel = [
  '我在编辑器里写下的不是页面像素，而是页面生成规则。',
  '这些规则会在后续阶段分别进入构建、交付、解析、运行时与更新链。',
  'RSC / SSR / Hydration 只是这条主链中的局部机制，不是最高层叙事。',
];

export const buildTransformationSteps = [
  '构建工具读取 app/、components/、lib/ 与静态资源引用。',
  'TypeScript / JSX 被编译成浏览器和服务器可执行的 JavaScript。',
  'CSS、图片、字体等资源被整理、转换、切分。',
  '最终生成 HTML、客户端 JS、CSS、服务端逻辑与其他静态资源。',
];

export const artifactDeliveryPath = [
  'next dev / next build 产出运行时可交付资源',
  'Node runtime / 静态文件目录负责暴露这些资源',
  '浏览器发起请求',
  '浏览器收到 HTML / JS / CSS / 其他资源字节流',
];

export const browserRenderPipelineSteps = [
  'HTML -> DOM',
  'CSS -> CSSOM',
  'DOM + CSSOM -> Render Tree',
  'Style -> Layout -> Paint -> Composite',
  'GPU / 显示系统输出首屏像素',
];


export const firstPaintTrack = [
  '编辑器里写下结构 / 状态 / 样式 / 数据规则',
  '构建把源码变成 HTML / CSS / JS / 服务端逻辑',
  '服务器把首批资源交给浏览器',
  '浏览器解析 HTML / CSS / JS',
  'DOM + CSSOM 进入 Render Tree / Style / Layout / Paint / Composite',
  '用户第一次看到页面',
];

export const interactionUpdateTrack = [
  '用户点击 / 输入 / 滚动',
  '浏览器把输入转换成事件',
  '客户端 JS 事件处理函数运行',
  '应用状态变化',
  'React 重新计算受影响的 UI',
  '局部 DOM / 样式 / 布局 / 绘制更新',
  '用户看到系统响应',
];

export const interactionUpdateNarrative = [
  '用户点击 / 输入 / 滚动',
  '浏览器把输入转成事件',
  'JavaScript 处理函数执行',
  '应用状态变化',
  'React 重新计算受影响的 UI',
  'DOM / 样式 / 布局 / 绘制发生局部变化',
  '用户看到系统响应',
];

export const sourceToBrowserMappings: MappingTriplet[] = [
  {
    title: '结构规则',
    sourceSnippet: `<main>
  <h1>商品详情</h1>
  <ProductCard />
</main>`,
    buildArtifact: '构建把 JSX 转成运行时代码，并在首屏阶段产出可解析的 HTML 结构。',
    browserResult: '浏览器先解析 HTML 生成 DOM，后续 DOM 参与 Render Tree 计算。',
  },
  {
    title: '样式规则',
    sourceSnippet: `.card {
  display: grid;
  color: #102033;
}`,
    buildArtifact: 'CSS 被抽出、整理、切分，成为浏览器可请求和缓存的样式资源。',
    browserResult: '浏览器解析 CSS 生成 CSSOM，再参与 Style / Layout / Paint。',
  },
  {
    title: '交互规则',
    sourceSnippet: `function onClick() {
  setCount((v) => v + 1);
}`,
    buildArtifact: '客户端交互逻辑进入 client bundle，等待 hydration 后真正接管事件。',
    browserResult: '点击后事件处理函数执行，状态变化，React 更新局部 DOM。',
  },
  {
    title: '服务端数据规则',
    sourceSnippet: `const data = await loadProduct();
return <Page data={data} />;`,
    buildArtifact: '服务端逻辑保留在服务器侧，输出的是可交付结果，而不是把取数函数发给浏览器。',
    browserResult: '浏览器看到的是已经带数据的首屏结果，再继续进入解析与渲染流程。',
  },
];

export function createLinearChainStages(): ChainStage[] {
  return [
    {
      id: 'source',
      phase: 'Stage 1',
      title: '源码描述阶段',
      input: ['需求、状态设计、组件结构、样式规则、交互规则'],
      output: ['React / Next.js 源码、路由、组件树、CSS 引用'],
      explanation: '源码不是页面本身，而是页面如何生成与如何更新的规则。',
      keyQuestion: '我在 VSCode 里到底写下了什么？',
    },
    {
      id: 'build',
      phase: 'Stage 2',
      title: '构建处理阶段',
      input: ['源码文件、import 依赖图、静态资源'],
      output: ['HTML、客户端 JS、CSS、服务端逻辑、构建产物清单'],
      explanation: '构建负责把开发时语义转成浏览器和服务器能消费的产物。',
      keyQuestion: '源码如何变成可交付文件？',
    },
    {
      id: 'delivery',
      phase: 'Stage 3',
      title: '资源交付阶段',
      input: ['HTML / JS / CSS / 图片 / 字体等产物'],
      output: ['浏览器收到的响应字节流'],
      explanation: '交给浏览器的是字节，不是“组件对象”本身。',
      keyQuestion: '浏览器真正收到的是什么？',
    },
    {
      id: 'parse',
      phase: 'Stage 4',
      title: '浏览器解析与首屏渲染阶段',
      input: ['HTML 字节、CSS 字节、JS 字节'],
      output: ['DOM、CSSOM、Render Tree、首屏像素'],
      explanation: '像素由浏览器渲染流水线生成，而不是框架直接画到屏幕上。',
      keyQuestion: '字节怎么变成首屏像素？',
    },
    {
      id: 'hydrate',
      phase: 'Stage 5',
      title: 'hydration 与可交互阶段',
      input: ['首屏 HTML、客户端 JS、框架运行时'],
      output: ['已绑定事件的可交互页面'],
      explanation: '先能看，后能点。页面显示出来不等于已经完成接管。',
      keyQuestion: '为什么页面能看见却不一定立刻能点？',
    },
    {
      id: 'update',
      phase: 'Stage 6',
      title: '交互与增量更新阶段',
      input: ['用户事件、当前状态、必要时的接口响应'],
      output: ['新状态、新 DOM、新一轮样式 / 布局 / 绘制结果'],
      explanation: '点击后触发的是局部更新链，不是把整站重跑一遍。',
      keyQuestion: '用户点击后，系统内部到底重算了什么？',
    },
  ];
}


export type SimulatorStep = {
  id: string;
  label: string;
  location: string;
  input: string[];
  output: string[];
  nextStep: string;
};

export const simulatorSteps: SimulatorStep[] = [
  {
    id: 'source',
    label: '源码阶段',
    location: 'VSCode / 项目目录',
    input: ['需求、状态设计、结构设计、样式设计、交互设计'],
    output: ['组件源码、路由、样式规则、数据读取规则'],
    nextStep: '进入构建阶段',
  },
  {
    id: 'build',
    label: '构建阶段',
    location: 'next dev / next build / CI',
    input: ['源码文件、依赖图、静态资源引用'],
    output: ['HTML、CSS、客户端 JS、服务端逻辑、静态资源'],
    nextStep: '进入资源交付阶段',
  },
  {
    id: 'delivery',
    label: '交付阶段',
    location: 'Node / dev server / CDN / 浏览器网络层',
    input: ['HTML / JS / CSS / 图片 / 字体等产物'],
    output: ['浏览器收到的响应字节流'],
    nextStep: '进入浏览器解析阶段',
  },
  {
    id: 'parse',
    label: '浏览器解析阶段',
    location: '浏览器解析器与渲染流水线',
    input: ['HTML 字节、CSS 字节、JS 字节'],
    output: ['DOM、CSSOM、Render Tree、首屏像素'],
    nextStep: '进入 hydration 阶段',
  },
  {
    id: 'hydrate',
    label: 'hydration 阶段',
    location: '浏览器 JS 运行时',
    input: ['首屏 HTML、客户端 JS、React 运行时'],
    output: ['已绑定事件的可交互页面'],
    nextStep: '进入交互更新阶段',
  },
  {
    id: 'update',
    label: '交互更新阶段',
    location: '浏览器事件系统 + React 运行时 + 必要时的服务端接口',
    input: ['用户事件、当前状态、必要时的接口响应'],
    output: ['新状态、新 DOM、局部重渲染后的屏幕结果'],
    nextStep: '继续等待下一次用户输入',
  },
];
