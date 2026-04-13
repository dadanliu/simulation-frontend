// TypeScript + JSX 输入样例：浏览器不能直接执行这份源码。
type Props = {
  title: string;
};

export function App({ title }: Props) {
  const count: number = 1;
  return <h1>{title} {count}</h1>;
}
