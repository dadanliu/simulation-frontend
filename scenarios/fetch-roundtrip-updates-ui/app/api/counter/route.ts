import { NextResponse } from 'next/server';

let counterValue = 0;

export async function POST() {
  counterValue += 1;

  return NextResponse.json({
    requestHandledAt: new Date().toISOString(),
    nextValue: counterValue,
  });
}
