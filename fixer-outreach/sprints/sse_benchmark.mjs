// Standalone, dependency-free SSE delimiter scanning benchmark.
// Demonstrates algorithmic scan cost only, NOT a reproduction of Google's SDK.
import { performance } from 'node:perf_hooks';
const sizes = [1024*1024, 4*1024*1024];
const chunkSize = 64*1024;
function naive(chunks) {
  let buffer = '', checks=0;
  for (const chunk of chunks) {
    buffer += chunk;
    checks += buffer.length;
    buffer.indexOf('\n\n');
  }
  return checks;
}
function windowed(chunks) {
  let buffer = '', checks=0;
  for (const chunk of chunks) {
    const boundary = buffer.slice(-3) + chunk;
    checks += boundary.length;
    boundary.indexOf('\n\n');
    buffer += chunk;
  }
  return checks;
}
for (const size of sizes) {
  const chunks=[];
  for(let i=0;i<size;i+=chunkSize) chunks.push('A'.repeat(Math.min(chunkSize,size-i)));
  const t0=performance.now(); const old=naive(chunks); const t1=performance.now();
  const fresh=windowed(chunks); const t2=performance.now();
  console.log(JSON.stringify({eventBytes:size,chunkBytes:chunkSize,naiveScannedChars:old,windowedScannedChars:fresh,scanRatio:Math.round(old/fresh),naiveMs:+(t1-t0).toFixed(2),windowedMs:+(t2-t1).toFixed(2)}));
}
