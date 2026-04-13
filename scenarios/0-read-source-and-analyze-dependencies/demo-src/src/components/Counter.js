// Counter 继续依赖一个样式相关模块。
import { buttonClassName } from '../styles/button.js';

export function Counter(initialValue) {
  return { type: 'button', className: buttonClassName, text: initialValue };
}
