// UUIDv7: a millisecond timestamp followed by random bits. Made on the device,
// so every event has a stable id before it ever reaches the server and retried
// uploads can't create duplicates.

const hex = (n: number, width: number) => n.toString(16).padStart(width, '0');

function randomHex(chars: number): string {
  let out = '';
  while (out.length < chars) out += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return out.slice(0, chars);
}

export function uuidv7(now: number = Date.now()): string {
  const ts = hex(Math.floor(now), 12);
  const rand = randomHex(20);
  const variant = ((parseInt(rand[3], 16) & 0x3) | 0x8).toString(16);
  return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${rand.slice(0, 3)}-${variant}${rand.slice(4, 7)}-${rand.slice(8, 20)}`;
}
