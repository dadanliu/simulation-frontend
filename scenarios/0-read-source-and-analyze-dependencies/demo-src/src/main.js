// 入口文件：构建工具就是从这里开始往下读。
import { createRoot } from 'react-dom/client';

// 本地依赖：构建工具会继续递归读取 ./App.js。
import { App } from './App.js';

// 资源依赖：对构建工具来说，这也是一条依赖边。
import './styles/global.css';

createRoot(document.getElementById('root')).render(App());
