const fs = require('fs');
const path = require('path');
const { transformSync } = require('@babel/core');

function compileTsxWithBabel(code, filename = 'input.tsx') {
  const result = transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    comments: true,
    compact: false,
    presets: [
      [require.resolve('@babel/preset-typescript'), { allExtensions: true, isTSX: true }],
      [require.resolve('@babel/preset-react'), { runtime: 'classic' }],
    ],
  });

  return {
    inputKind: 'tsx',
    outputKind: 'javascript',
    code: result?.code ?? '',
  };
}

function main(inputDir) {
  const tsxPath = path.resolve(inputDir, 'input.tsx');
  const tsxCode = fs.readFileSync(tsxPath, 'utf8');
  const compiled = compileTsxWithBabel(tsxCode, tsxPath);

  const result = {
    purpose: 'use Babel to compile TSX and JSX syntax into browser-runnable javascript',
    tool: 'babel',
    files: [
      {
        source: 'demo-input/input.tsx',
        steps: [
          'parse tsx syntax',
          'strip type annotations with preset-typescript',
          'transform jsx with preset-react',
        ],
        output: compiled,
      },
    ],
    notes: [
      '这个 Babel 对照脚本只演示 TSX/JSX 编译链路。',
      'Vue template 仍然需要 Vue 自己的编译器处理，不属于 Babel 的直接职责。',
    ],
  };

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main(process.argv[2] || 'demo-input');
}

module.exports = { compileTsxWithBabel };
