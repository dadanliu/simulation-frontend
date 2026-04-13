const path = require('path');

module.exports = {
  mode: 'development',

  // 和手写 mini-bundler 一样，Webpack 也需要一个入口，才能开始构建模块图。
  entry: path.resolve(__dirname, 'demo-src/src/main.js'),

  output: {
    path: path.resolve(__dirname, 'webpack-dist'),
    filename: 'bundle.js',
    clean: true,
  },

  module: {
    rules: [
      {
        // 这里只是为了让 demo 里的 CSS import 能被 Webpack 接住。
        // 我们不追求完整样式处理，只做最小可运行对比。
        test: /\.css$/,
        type: 'asset/source',
      },
    ],
  },

  stats: {
    preset: 'normal',
    modules: true,
    reasons: true,
  },
};
