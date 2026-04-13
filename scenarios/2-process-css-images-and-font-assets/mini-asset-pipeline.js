const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function shortHash(content) {
  return crypto.createHash('sha1').update(content).digest('hex').slice(0, 8);
}

function minifySvg(svg) {
  return svg
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n/g, '')
    .trim();
}

function minifyCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,])\s*/g, '$1').trim();
}

function detectAssetKind(sourcePath) {
  const ext = path.extname(sourcePath).toLowerCase();

  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
    return 'image';
  }

  if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) {
    return 'font';
  }

  return 'asset';
}

function createPreviewHtml(cssPath) {
  // 这个 HTML 不是完整构建结果，只是一个最小观察壳：
  // 让浏览器先加载 CSS，再由 CSS 继续触发图片和字体请求。
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Asset Pipeline Preview</title>
    <link rel="stylesheet" href="./${cssPath}" />
  </head>
  <body>
    <main class="page-shell">
      <h1>Asset Pipeline Preview</h1>
      <p>这个 HTML 只是一个观察壳，用来触发 CSS、图片和字体资源的加载。</p>
      <button class="primary-button">Load Styled Assets</button>
      <p>如果样式生效，你会看到背景图、字体引用和按钮渐变。</p>
    </main>
  </body>
</html>
`;
}

function main(inputDir) {
  const scenarioRoot = process.cwd();
  const inputRoot = path.resolve(scenarioRoot, inputDir);
  const distRoot = path.resolve(scenarioRoot, 'dist');
  const distCssDir = path.join(distRoot, 'css');
  const distImageDir = path.join(distRoot, 'images');
  const distFontDir = path.join(distRoot, 'fonts');
  const distAssetDir = path.join(distRoot, 'assets');
  const entryCssPath = path.join(inputRoot, 'styles', 'app.css');

  // 每次运行都重建 dist，方便直接观察“当前这次处理”到底输出了什么。
  fs.rmSync(distRoot, { recursive: true, force: true });
  fs.mkdirSync(distCssDir, { recursive: true });
  fs.mkdirSync(distImageDir, { recursive: true });
  fs.mkdirSync(distFontDir, { recursive: true });
  fs.mkdirSync(distAssetDir, { recursive: true });

  const emittedAssets = new Map();
  const cssInputs = [];
  const pipeline = [];

  // 把一个被 CSS 引用到的静态资源变成真正的构建产物。
  // 例子：
  // - 输入：demo-input/images/logo.svg
  // - 处理：识别为 image，给内容算 hash，对 svg 做最小压缩
  // - 输出：dist/images/logo.<hash>.svg
  // - 同时返回一份 assetInfo，供后续把 CSS 里的 url("../images/logo.svg")
  //   改写成 url("../images/logo.<hash>.svg")
  function emitAsset(sourcePath) {
    const absoluteSourcePath = path.resolve(sourcePath);

    if (emittedAssets.has(absoluteSourcePath)) {
      return emittedAssets.get(absoluteSourcePath);
    }

    const sourceBuffer = fs.readFileSync(absoluteSourcePath);
    const ext = path.extname(absoluteSourcePath);
    const basename = path.basename(absoluteSourcePath, ext);
    const kind = detectAssetKind(absoluteSourcePath);

    let outputBuffer = sourceBuffer;
    const transforms = ['content hash rename'];

    // 这里故意只做一个最小“转换”例子，让读者看到资源处理不只是复制文件。
    if (ext.toLowerCase() === '.svg') {
      outputBuffer = Buffer.from(minifySvg(sourceBuffer.toString('utf8')));
      transforms.unshift('svg whitespace cleanup');
    }

    const hash = shortHash(outputBuffer);
    const outputName = `${basename}.${hash}${ext}`;
    const outputDir =
      kind === 'image' ? distImageDir : kind === 'font' ? distFontDir : distAssetDir;
    const outputPath = path.join(outputDir, outputName);

    // “发射资源文件”是这一步的核心职责之一：
    // 原始资源不再按源码路径交付，而是进入构建产物目录。
    fs.writeFileSync(outputPath, outputBuffer);

    const assetInfo = {
      kind,
      source: toPosix(path.relative(scenarioRoot, absoluteSourcePath)),
      output: toPosix(path.relative(scenarioRoot, outputPath)),
      cssUrl: toPosix(path.relative(distCssDir, outputPath)),
      transforms,
    };

    emittedAssets.set(absoluteSourcePath, assetInfo);
    pipeline.push({
      stage: 'emit asset file',
      input: assetInfo.source,
      output: assetInfo.output,
      detail: `${kind} -> ${assetInfo.cssUrl}`,
    });
    return assetInfo;
  }

  // 把一个 CSS 文件展开成“最终可输出的一份 CSS 字符串”。
  // 例子：
  // - 输入：demo-input/styles/app.css
  // - 如果里面有 @import "./button.css"，就递归把 button.css 内联进来
  // - 如果里面有 url("../fonts/demo-sans.woff2")，就调用 emitAsset() 发射字体文件
  // - 输出：一份已经完成 import 内联、资源 URL 也被改写过的 CSS 文本
  function inlineCss(filePath, seen = new Set()) {
    const absoluteFilePath = path.resolve(filePath);

    if (seen.has(absoluteFilePath)) {
      return '';
    }

    seen.add(absoluteFilePath);
    cssInputs.push(toPosix(path.relative(scenarioRoot, absoluteFilePath)));

    const rawCss = fs.readFileSync(absoluteFilePath, 'utf8');
    // 用递归内联 import，模拟 bundler 把分散的样式拼回一个输出入口。
    const withImportsInlined = rawCss.replace(
      /@import\s+['"](.+?)['"];\s*/g,
      (_, importTarget) => {
        const importedPath = path.resolve(path.dirname(absoluteFilePath), importTarget);
        pipeline.push({
          stage: 'inline css import',
          input: toPosix(path.relative(scenarioRoot, absoluteFilePath)),
          output: toPosix(path.relative(scenarioRoot, importedPath)),
          detail: importTarget,
        });
        return inlineCss(importedPath, seen);
      }
    );

    return withImportsInlined.replace(/url\(([^)]+)\)/g, (_, rawUrl) => {
      const cleanedUrl = rawUrl.trim().replace(/^['"]|['"]$/g, '');

      // data URL、绝对地址、远程地址不在这个教学脚本的“发射资源”范围内，
      // 这里直接保留，避免把边界讲混。
      if (/^(data:|https?:|\/)/.test(cleanedUrl)) {
        return `url("${cleanedUrl}")`;
      }

      // 相对资源则进入这条场景真正想讲的链路：
      // 识别 -> 输出新文件 -> 把 CSS 里的 URL 改写成产物路径。
      const assetInfo = emitAsset(path.resolve(path.dirname(absoluteFilePath), cleanedUrl));
      pipeline.push({
        stage: 'rewrite css url',
        input: cleanedUrl,
        output: assetInfo.cssUrl,
        detail: assetInfo.output,
      });
      return `url("${assetInfo.cssUrl}")`;
    });
  }

  pipeline.push({
    stage: 'read entry css',
    input: toPosix(path.relative(scenarioRoot, entryCssPath)),
    output: 'memory',
    detail: 'start from the main stylesheet entry',
  });

  const bundledCss = inlineCss(entryCssPath);
  const transformedCss = minifyCss(bundledCss);
  const cssHash = shortHash(transformedCss);
  const outputCssPath = path.join(distCssDir, `app.${cssHash}.css`);
  const outputHtmlPath = path.join(distRoot, 'index.html');

  // CSS 本身也会作为最终产物被重新命名和输出，而不是停留在源码目录里。
  fs.writeFileSync(outputCssPath, `${transformedCss}\n`);

  pipeline.push({
    stage: 'emit bundled css',
    input: cssInputs.join(', '),
    output: toPosix(path.relative(scenarioRoot, outputCssPath)),
    detail: 'minified css with rewritten asset urls',
  });

  const previewHtml = createPreviewHtml(toPosix(path.relative(distRoot, outputCssPath)));
  fs.writeFileSync(outputHtmlPath, previewHtml);

  pipeline.push({
    stage: 'emit preview html',
    input: toPosix(path.relative(scenarioRoot, outputCssPath)),
    output: toPosix(path.relative(scenarioRoot, outputHtmlPath)),
    detail: 'minimal html shell that references the emitted css output',
  });

  const manifestPath = path.join(distRoot, 'asset-manifest.json');

  // 这个结果对象一方面给终端看，另一方面也会写成 manifest，
  // 用来把 README 里的流程图和真实输出字段对应起来。
  const result = {
    purpose: 'simulate how bundlers process css, images, and fonts before output',
    entry: 'demo-input/styles/app.css',
    boundaries: {
      responsibleFor: [
        'collecting css imports',
        'resolving image and font references',
        'rewriting emitted asset urls',
        'emitting hashed css and asset files',
        'emitting a tiny preview html for observing resource loading',
      ],
      notResponsibleFor: [
        'full application html generation',
        'javascript chunk splitting',
        'cdn deployment',
        'browser parsing or rendering',
      ],
    },
    steps: [
      'inline imported css',
      'collect url() assets',
      'organize files by asset type',
      'rewrite asset urls to emitted files',
      'minify css and emit hashed outputs',
    ],
    pipeline,
    cssInputs,
    emittedFiles: {
      html: toPosix(path.relative(scenarioRoot, outputHtmlPath)),
      css: toPosix(path.relative(scenarioRoot, outputCssPath)),
      assets: Array.from(emittedAssets.values()),
    },
    manifest: 'dist/asset-manifest.json',
    notes: [
      '这是教学级近似：只演示资源整理、轻量变换、改名和输出分桶。',
      'demo-input/fonts/demo-sans.woff2 是占位文件，重点是观察“字体资源也会被识别、改名和输出”。',
      '真实工程里通常还会有 source map、压缩策略、更多 loader/plugin、并行优化和缓存。',
    ],
  };

  // 把本次处理链固化成文件，方便和 dist/ 里的实际产物对照着看。
  fs.writeFileSync(manifestPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main(process.argv[2] || 'demo-input');
}
