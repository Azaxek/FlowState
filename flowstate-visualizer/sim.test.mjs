// Headless check: run both controllers on identical random traffic and compare.
// Usage: node sim.test.mjs
import { createSim, stepSim, simStats } from './src/sim.js';

let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
Math.random = rand;

const run = (mode, secs = 600) => {
  seed = 42;
  const s = createSim(mode, { ambulances: false });
  for (let i = 0; i < secs / 0.016; i++) stepSim(s, 0.016);
  return simStats(s);
};

const base = run('baseline');
const adapt = run('flux');
console.log('baseline', base);
console.log('adaptive', adapt);
console.log(`wait change: ${(((adapt.avgWait - base.avgWait) / base.avgWait) * 100).toFixed(1)}%`);
if (!(adapt.avgWait < base.avgWait)) { console.error('FAIL: adaptive did not beat fixed timing'); process.exit(1); }
