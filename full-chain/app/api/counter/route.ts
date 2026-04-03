import { NextResponse } from 'next/server';

let serverCounter = 0;

export async function POST() {
  serverCounter += 1;

  return NextResponse.json({
    requestHandledAt: new Date().toISOString(),
    nextServerCount: serverCounter,
    explanation: '这次更新经过了浏览器 fetch -> Route Handler -> JSON 响应 -> React 状态更新。',
  });
}
