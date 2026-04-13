// 这些 import 会让构建工具继续向下扩展依赖图。
import { Header } from './components/Header.js';
import { Counter } from './components/Counter.js';
import { formatCount } from './utils/format.js';

export function App() {
  return {
    type: 'div',
    children: [Header(), Counter(formatCount(1))],
  };
}
