const fs = require('fs');
const path = require('path');

// 这里只关心最小主线：读取 import 语句里的模块路径。
// 它不是完整 JS 语法解析器，只够支撑这个教学场景。
const importRegex = /import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;

// 这个最简 bundler 只支持少量文件类型，故意保持收敛。
const exts = ['.js', '.jsx', '.css'];

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function relativeId(rootDir, filePath) {
  return toPosix(path.relative(rootDir, filePath));
}

function candidatePaths(seed) {
  const list = [seed];

  // 如果 import 没写扩展名，就按常见规则尝试补全。
  // 这一步对应真实构建工具里的“模块解析”。
  if (!exts.includes(path.extname(seed))) {
    for (const ext of exts) list.push(`${seed}${ext}`);
    list.push(path.join(seed, 'index.js'));
    list.push(path.join(seed, 'index.jsx'));
  }

  return [...new Set(list)];
}

function resolveImport(fromFile, specifier, rootDir) {
  // 不是相对路径，先把它当成外部依赖。
  // 在真实工具里，这类路径通常会继续走 node_modules / package exports 解析。
  if (!specifier.startsWith('.')) {
    return { resolved: specifier, external: true, found: true, absolutePath: specifier };
  }

  const absoluteSeed = path.resolve(path.dirname(fromFile), specifier);

  // 从“相对引用字符串”尝试解析到“真实文件路径”。
  for (const candidate of candidatePaths(absoluteSeed)) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return {
        resolved: relativeId(rootDir, candidate),
        external: false,
        found: true,
        absolutePath: candidate,
      };
    }
  }

  // 这里保留 unresolved 结果，是为了让输出能显式告诉你：
  // “这里本来想依赖一个文件，但没找到”。
  return {
    resolved: relativeId(rootDir, absoluteSeed),
    external: false,
    found: false,
    absolutePath: absoluteSeed,
  };
}

function buildGraph(entryFile, rootDir) {
  const visited = new Set();
  const visitedOrder = [];
  const nodes = [];
  const edges = [];

  function visit(absoluteFilePath) {
    const moduleId = relativeId(rootDir, absoluteFilePath);

    // 防止循环依赖或重复遍历导致死循环。
    if (visited.has(moduleId)) return;
    visited.add(moduleId);
    visitedOrder.push(moduleId);

    // 构建工具的第一手输入，本质上就是源码文本。
    const code = fs.readFileSync(absoluteFilePath, 'utf8');
    const imports = [];

    for (const match of code.matchAll(importRegex)) {
      const raw = match[1];
      const resolved = resolveImport(absoluteFilePath, raw, rootDir);

      // 这里记录“当前模块直接依赖了谁”。
      imports.push({
        raw,
        resolved: resolved.resolved,
        external: resolved.external,
        found: resolved.found,
      });

      // 边列表更适合从全局视角看依赖图。
      edges.push({
        from: moduleId,
        to: resolved.resolved,
        external: resolved.external,
        found: resolved.found,
      });

      // 只有“本地依赖且成功解析到文件”的情况，才继续递归读取。
      if (!resolved.external && resolved.found) {
        visit(resolved.absolutePath);
      }
    }

    nodes.push({ filePath: moduleId, code, imports });
  }

  visit(path.resolve(entryFile));

  return {
    entry: relativeId(rootDir, entryFile),
    visitedOrder,
    nodes,
    edges,

    // 这不是严格拓扑排序，只是一个足够帮助理解的“后处理顺序”。
    topologicalLikeOrder: [...visitedOrder].reverse(),
  };
}

if (require.main === module) {
  const rootDir = path.resolve(process.argv[2] || 'demo-src');
  const entryFile = path.resolve(process.argv[3] || path.join(rootDir, 'src/main.js'));
  const result = buildGraph(entryFile, rootDir);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { buildGraph };
