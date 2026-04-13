// 这个入口故意只做一件事：让 Webpack 接管 CSS，
// 再由 CSS 里的 url(...) 继续触发图片和字体资源处理。
import './demo-input/styles/app.css';
