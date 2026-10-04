// Traffic logic with no React/Three dependency, so it can be unit-run headlessly (see sim.test.mjs).
// Axis 0 = north/south lanes (0, 1); axis 1 = east/west lanes (2, 3).
const SPAWN_RATE = 0.02;   // chance per 16 ms frame
const CAR_SPEED = 0.3;     // same for both modes, so the comparison is fair
const SPAWN_DIST = 120;
const STOP_LINE_DIST = 12;

const axisOf = (lane) => (lane < 2 ? 0 : 1);
const dist = (p) => Math.hypot(p[0], p[2]);
const movingAway = (car) => car.pos[0] * car.dirVec[0] + car.pos[2] * car.dirVec[2] > 0;

const SPAWNS = [
  { pos: [-2, 0, -SPAWN_DIST], rot: [0, 0, 0], dirVec: [0, 0, 1] },
  { pos: [2, 0, SPAWN_DIST], rot: [0, Math.PI, 0], dirVec: [0, 0, -1] },
  { pos: [SPAWN_DIST, 0, -2], rot: [0, -Math.PI / 2, 0], dirVec: [-1, 0, 0] },
  { pos: [-SPAWN_DIST, 0, 2], rot: [0, Math.PI / 2, 0], dirVec: [1, 0, 0] },
];

const lightColors = (axis, stage) => {
  const out = ['red', 'red'];
  out[axis] = stage;
  return out;
};

// Baseline: fixed 14 s cycle (6 s green, 1 s yellow per axis).
const fixedPhase = (t) => {
  const c = t % 14;
  if (c < 6) return [0, 'green'];
  if (c < 7) return [0, 'yellow'];
  if (c < 13) return [1, 'green'];
  return [1, 'yellow'];
};

// Adaptive: a simple queue-aware rule (not the trained PPO model).
// Hold green at least 3 s, then switch when this axis is empty and the other has cars,
// when the other side is clearly longer, or after a 14 s maximum.
const adaptiveStep = (ctl, t, queues) => {
  const mine = queues[ctl.axis];
  const other = queues[1 - ctl.axis];
  const age = t - ctl.since;
  if (ctl.stage === 'green') {
    if (age >= 3 && other > 0 && (mine === 0 || age >= 14 || (other > mine + 2 && age >= 6))) {
      ctl.stage = 'yellow'; ctl.since = t;
    }
  } else if (age >= 1) {
    ctl.axis = 1 - ctl.axis; ctl.stage = 'green'; ctl.since = t;
  }
};

export const createSim = (mode, { ambulances = true } = {}) => ({
  mode, ambulances, t: 0, t0: 0, cars: [], lights: ['red', 'green'], nextId: 0,
  ctl: { axis: 1, stage: 'green', since: 0 }, waitSum: 0, done: 0, waitingNow: 0,
});

export const simStats = (s) => ({
  avgWait: s.done ? s.waitSum / s.done : null,
  perMin: s.t - s.t0 > 20 ? (s.done / (s.t - s.t0)) * 60 : null,
  waitingNow: s.waitingNow,
});

// Advance the simulation by dt seconds of simulated time.
export const stepSim = (s, dt) => {
  const frames = dt / 0.016;
  s.t += dt;

  // Queues: approaching cars within 40 units of the junction, per axis
  const queues = [0, 0];
  s.waitingNow = 0;
  for (const c of s.cars) {
    if (!movingAway(c) && dist(c.pos) < 40) queues[axisOf(c.lane)]++;
    if (c.speed < 0.05) s.waitingNow++;
  }
  const ambulance = s.cars.find((c) => c.type === 'ambulance' && !movingAway(c));

  // 1. Lights
  if (s.mode === 'baseline') {
    s.lights = lightColors(...fixedPhase(s.t));
  } else if (ambulance) {
    // Emergency preemption (concept demo): hold green for the ambulance's axis
    s.ctl.axis = axisOf(ambulance.lane); s.ctl.stage = 'green'; s.ctl.since = s.t;
    s.lights = lightColors(s.ctl.axis, 'green');
  } else {
    adaptiveStep(s.ctl, s.t, queues);
    s.lights = lightColors(s.ctl.axis, s.ctl.stage);
  }

  // 2. Spawn
  if (Math.random() < SPAWN_RATE * frames) {
    const lane = Math.floor(Math.random() * 4);
    const sp = SPAWNS[lane];
    const blocked = s.cars.some((c) => Math.hypot(c.pos[0] - sp.pos[0], c.pos[2] - sp.pos[2]) < 15);
    if (!blocked) {
      const isAmbulance = s.ambulances && Math.random() < 0.03;
      s.cars.push({
        id: s.nextId++, type: isAmbulance ? 'ambulance' : 'car', lane, ...sp, waited: 0, speed: 0,
        hue: 190 + Math.random() * 60, sat: 65 + Math.random() * 25, lum: 50 + Math.random() * 20,
        speedFactor: 0.9 + Math.random() * 0.2,
      });
    }
  }

  // 3. Move cars (each car reads the previous positions of the others)
  const accel = 0.01 * frames;
  const brake = 0.08 * frames;
  const prev = s.cars;
  const next = [];
  for (const car of prev) {
    const away = movingAway(car);
    const d = dist(car.pos);
    const target = (car.type === 'ambulance' ? 0.65 : CAR_SPEED) * car.speedFactor;
    let speed = Math.min(car.speed + accel, target);
    let mustStop = false;

    // Stop line: observe the light unless already committed to crossing
    if (!away && d > STOP_LINE_DIST && d < STOP_LINE_DIST + 7) {
      const committed = d < STOP_LINE_DIST + 2 && speed > 0.1;
      const light = s.lights[axisOf(car.lane)];
      if (!committed && (light === 'red' || light === 'yellow')) mustStop = true;
      if (car.type === 'ambulance' && s.mode === 'flux') mustStop = false;
    }
    // Keep a gap to the car ahead in the same lane
    for (const o of prev) {
      if (o.id === car.id || o.lane !== car.lane) continue;
      const ahead = (o.pos[0] - car.pos[0]) * car.dirVec[0] + (o.pos[2] - car.pos[2]) * car.dirVec[2];
      if (ahead > 0 && ahead < 8) { mustStop = true; break; }
    }
    if (mustStop) speed = Math.max(0, speed - brake);

    const step = speed * frames;
    const pos = [car.pos[0] + car.dirVec[0] * step, 0, car.pos[2] + car.dirVec[2] * step];
    const waited = car.waited + (speed < 0.05 && !away ? dt : 0);

    if (away && d > 125) { s.done++; s.waitSum += waited; continue; }
    next.push({ ...car, pos, speed, waited });
  }
  s.cars = next;
};

// Run the sim forward so the scene opens with traffic already on the road, then restart the counters.
export const warmUp = (s, secs = 45) => {
  for (let i = 0; i < secs / 0.05; i++) stepSim(s, 0.05);
  s.done = 0; s.waitSum = 0; s.t0 = s.t;
  return s;
};
