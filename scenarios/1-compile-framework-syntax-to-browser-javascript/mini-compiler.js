const fs = require('fs');
const path = require('path');

// 这是一个教学用的最小 transform，不追求语法完整，只暴露编译阶段的核心动作：
// 去掉类型、改写 JSX、把 Vue template 变成 render 字符串。

function stripTypeAliases(code) {
  // 删除最简单的 type 声明块，模拟“类型只在开发期存在”。
  return code.replace(/type\s+\w+\s*=\s*\{[\s\S]*?\};?\n?/g, '');
}

function stripTypeAnnotations(code) {
  // 删除最简单的变量/参数类型标注，模拟 TypeScript 擦除类型信息。
  return code
    .replace(/: \w+/g, '')
    .replace(/\}\s*:\s*\w+/g, '}');
}

function transformSimpleJsx(code) {
  // 这里只处理最小 JSX 示例：<h1>{title} {count}</h1>
  // 目的是说明“JSX 需要被改写成普通 JS 表达”。
  return code.replace(
    /return <h1>\{title\} \{count\}<\/h1>;/g,
    "return React.createElement('h1', null, title + ' ' + count);"
  );
}

function compileTsx(code) {
  const step1 = stripTypeAliases(code);
  const step2 = stripTypeAnnotations(step1);
  const step3 = transformSimpleJsx(step2);
  return {
    inputKind: 'tsx',
    outputKind: 'javascript',
    code: step3,
  };
}

function extractVueTemplate(code) {
  const match = code.match(/<template>([\s\S]*?)<\/template>/);
  return match ? match[1].trim() : '';
}

function extractVueScript(code) {
  const match = code.match(/<script>([\s\S]*?)<\/script>/);
  return match ? match[1].trim() : '';
}

function templateToRenderExpression(template) {
  // 这里只做教学级近似：把 template 压成一个 render 描述字符串。
  return template
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\{\{\s*(\w+)\s*\}\}/g, "' + this.$data.$1 + '")
    .trim();
}

function compileVue(code) {
  const template = extractVueTemplate(code);
  const script = extractVueScript(code);
  const renderBody = templateToRenderExpression(template);
  const compiled = `${script}\n\nexport function render() {\n  return \`${renderBody}\`;\n}`;
  return {
    inputKind: 'vue-sfc',
    outputKind: 'javascript',
    code: compiled,
  };
}

function main(inputDir) {
  const tsxPath = path.resolve(inputDir, 'input.tsx');
  const vuePath = path.resolve(inputDir, 'input.vue');

  const tsxCode = fs.readFileSync(tsxPath, 'utf8');
  const vueCode = fs.readFileSync(vuePath, 'utf8');

  const tsxResult = compileTsx(tsxCode);
  const vueResult = compileVue(vueCode);

  const result = {
    purpose: 'simulate compile stage from framework syntax to browser-runnable javascript',
    files: [
      {
        source: 'demo-input/input.tsx',
        steps: ['strip type aliases', 'strip type annotations', 'transform jsx'],
        output: tsxResult,
      },
      {
        source: 'demo-input/input.vue',
        steps: ['extract template', 'extract script', 'turn template into render representation'],
        output: vueResult,
      },
    ],
  };

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main(process.argv[2] || 'demo-input');
}

module.exports = { compileTsx, compileVue };
