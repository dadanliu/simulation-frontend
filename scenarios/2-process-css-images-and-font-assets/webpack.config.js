const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'development',
  entry: path.resolve(__dirname, 'webpack-entry.js'),
  output: {
    path: path.resolve(__dirname, 'webpack-dist'),
    filename: 'js/runtime.[contenthash:8].js',
    clean: true,
  },
  module: {
    rules: [
      {
        // 让 Webpack 真正解析 CSS import，并继续接住里面的 url(...)。
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        // 交给 asset modules 处理图片，自动输出到 images 目录并改名。
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name].[contenthash:8][ext]',
        },
      },
      {
        // 字体资源也走同一条“发射文件 + 回写 URL”的路径。
        test: /\.(woff2?|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name].[contenthash:8][ext]',
        },
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/app.[contenthash:8].css',
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      inject: 'body',
      templateContent: () => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Webpack Asset Preview</title>
  </head>
  <body>
    <main class="page-shell">
      <h1>Webpack Asset Preview</h1>
      <p>这个页面由 HtmlWebpackPlugin 输出，用来观察真实 Webpack 产物如何引用 CSS、图片和字体。</p>
      <button class="primary-button">Load Styled Assets</button>
      <p>你可以对照 dist/ 和 webpack-dist/ 看两条资源处理链的共同点。</p>
    </main>
  </body>
</html>`,
    }),
  ],
  stats: {
    preset: 'normal',
    assets: true,
    modules: true,
  },
};
