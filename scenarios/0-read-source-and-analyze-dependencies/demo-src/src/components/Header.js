// 再往下一层依赖：Header 依赖 content 常量模块。
import { titleText } from '../constants/content.js';

export function Header() {
  return { type: 'h1', text: titleText };
}
