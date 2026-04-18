// HTTP/2 帧（Frame）编解码工具
//
// 真实 HTTP/2 帧结构（RFC 7540 Section 4.1）：
//
//   +-----------------------------------------------+
//   |                Length (24 bits)               |   帧 payload 的字节数
//   +---------------+---------------+---------------+
//   |   Type (8)    |   Flags (8)   |
//   +-+-------------+---------------+-------------------------------+
//   |R|                Stream Identifier (31 bits)                  |
//   +=+=============================================================+
//   |                   Frame Payload (0..2^24-1 octets)            |
//   +---------------------------------------------------------------+
//
// 帧头固定 9 字节，后跟 Length 字节的 payload。
// 本模拟只实现 DATA 和 HEADERS 两种帧类型，
// HEADERS payload 用可读 JSON 替代真实的 HPACK 压缩（为了可观察）。

const FRAME_TYPES = {
  DATA: 0x0,     // 正文数据帧
  HEADERS: 0x1,  // 请求头 / 响应头帧
};

const FLAGS = {
  END_STREAM: 0x1,  // 这是这个 Stream 的最后一帧
};

// 把一帧编码成 Buffer
// type    : FRAME_TYPES 里的值
// flags   : FLAGS 里的值（可多个 OR 组合）
// streamId: 这帧属于哪个 Stream（奇数=客户端发起）
// payload : Buffer 或字符串（字符串自动转 utf-8）
function encodeFrame(type, flags, streamId, payload) {
  const payloadBuf = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(payload, 'utf-8');

  // 帧头 9 字节 + payload
  const frame = Buffer.alloc(9 + payloadBuf.length);

  // Length: 24 位，大端序
  frame.writeUIntBE(payloadBuf.length, 0, 3);

  // Type: 1 字节
  frame.writeUInt8(type, 3);

  // Flags: 1 字节
  frame.writeUInt8(flags, 4);

  // Stream Identifier: 31 位（最高位 R 保留，始终为 0）
  frame.writeUInt32BE(streamId & 0x7fffffff, 5);

  // Payload
  payloadBuf.copy(frame, 9);

  return frame;
}

// 从 Buffer 中解析出所有完整的帧
// 返回 { frames: [...], remaining: Buffer }
// remaining 是不够一帧的尾部字节，留给下次追加再解析
function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset + 9 <= buffer.length) {
    // 读帧头（9 字节）
    const length = buffer.readUIntBE(offset, 3);
    const type = buffer.readUInt8(offset + 3);
    const flags = buffer.readUInt8(offset + 4);
    const streamId = buffer.readUInt32BE(offset + 5) & 0x7fffffff;

    // payload 还没完全到达，停止解析，等下次数据
    if (offset + 9 + length > buffer.length) break;

    const payload = buffer.slice(offset + 9, offset + 9 + length);
    frames.push({ type, flags, streamId, payload, length });
    offset += 9 + length;
  }

  return {
    frames,
    remaining: buffer.slice(offset), // 不完整的尾部留着下次
  };
}

// 判断帧是否带 END_STREAM 标志
function isEndStream(frame) {
  return (frame.flags & FLAGS.END_STREAM) !== 0;
}

// 把帧类型数字转成可读字符串
function typeLabel(type) {
  return Object.entries(FRAME_TYPES).find(([, v]) => v === type)?.[0] ?? `0x${type.toString(16)}`;
}

module.exports = { FRAME_TYPES, FLAGS, encodeFrame, decodeFrames, isEndStream, typeLabel };
