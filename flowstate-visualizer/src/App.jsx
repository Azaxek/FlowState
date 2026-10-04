import { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { createSim, stepSim, simStats, warmUp } from './sim.js';

// --- CONFIGURATION ---
const LANE_WIDTH = 4;
const DASH_COUNT = 14;

// --- COMPONENTS ---

// 1. Road: dark ground, lighter asphalt strips, dashed centre lines, stop lines
const Road = () => {
  const dashes = [];
  for (let i = 0; i < DASH_COUNT; i++) {
    const p = 16 + i * 6.5;
    for (const s of [1, -1]) {
      dashes.push(
        <mesh key={`v${i}${s}`} position={[0, s * p, 0.04]}><planeGeometry args={[0.25, 3]} /><meshBasicMaterial color="#d8b64a" /></mesh>,
        <mesh key={`h${i}${s}`} position={[s * p, 0, 0.04]} rotation={[0, 0, Math.PI / 2]}><planeGeometry args={[0.25, 3]} /><meshBasicMaterial color="#d8b64a" /></mesh>
      );
    }
  }
  const stopLine = (pos, rot = 0) => (
    <mesh position={[...pos, 0.05]} rotation={[0, 0, rot]}><planeGeometry args={[LANE_WIDTH * 2, 0.8]} /><meshBasicMaterial color="#e8e8ee" /></mesh>
  );
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#0c0c16" roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.01]} receiveShadow>
        <planeGeometry args={[LANE_WIDTH * 2.2, 240]} />
        <meshStandardMaterial color="#2b2b33" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.02]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
        <planeGeometry args={[LANE_WIDTH * 2.2, 240]} />
        <meshStandardMaterial color="#2b2b33" roughness={0.9} />
      </mesh>
      {dashes}
      {stopLine([0, 11])}
      {stopLine([0, -11])}
      {stopLine([11, 0], Math.PI / 2)}
      {stopLine([-11, 0], Math.PI / 2)}
    </group>
  );
};

// 2. Realistic Traffic Light
const TrafficLight = ({ position, state, rotation = [0, 0, 0] }) => {
  // state: 'green', 'red', 'yellow'
  const redOn = state === 'red';
  const yellowOn = state === 'yellow';
  const greenOn = state === 'green';

  return (
    <group position={position} rotation={rotation}>
      {/* Pole */}
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 8]} />
        <meshStandardMaterial color="#111" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Housing Box */}
      <mesh position={[0, 7, 0.5]} castShadow>
        <boxGeometry args={[0.8, 2.2, 0.5]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Hoods (Simulated by angled planes or partial cylinders, keeping simple for perf) */}
      <mesh position={[0, 7.6, 0.8]} rotation={[0.5, 0, 0]}>
        <planeGeometry args={[0.6, 0.4]} />
        <meshStandardMaterial color="#000" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 7.0, 0.8]} rotation={[0.5, 0, 0]}>
        <planeGeometry args={[0.6, 0.4]} />
        <meshStandardMaterial color="#000" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 6.4, 0.8]} rotation={[0.5, 0, 0]}>
        <planeGeometry args={[0.6, 0.4]} />
        <meshStandardMaterial color="#000" side={THREE.DoubleSide} />
      </mesh>

      {/* Lights */}
      {/* RED */}
      <mesh position={[0, 7.6, 0.76]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial
          color={redOn ? "#ff0000" : "#330000"}
          emissive={redOn ? "#ff0000" : "#000000"}
          emissiveIntensity={redOn ? 4 : 0}
          toneMapped={false}
        />
      </mesh>
      {/* YELLOW */}
      <mesh position={[0, 7.0, 0.76]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial
          color={yellowOn ? "#ffaa00" : "#332200"}
          emissive={yellowOn ? "#ffaa00" : "#000000"}
          emissiveIntensity={yellowOn ? 3 : 0}
          toneMapped={false}
        />
      </mesh>
      {/* GREEN */}
      <mesh position={[0, 6.4, 0.76]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial
          color={greenOn ? "#00ff44" : "#001100"}
          emissive={greenOn ? "#00ff44" : "#000000"}
          emissiveIntensity={greenOn ? 4 : 0}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// 3. Cyberpunk/Modern Car with Brake Lights
const Car = ({ position, rotation, color, speed }) => {
  const isBraking = speed < 0.05;

  return (
    <group position={position} rotation={rotation}>
      {/* Body Chassis */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.6, 3.8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.2} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 1.0, -0.3]} castShadow>
        <boxGeometry args={[1.5, 0.7, 2.2]} />
        <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Headlights (Front) */}
      <mesh position={[0.6, 0.4, 1.91]}>
        <boxGeometry args={[0.4, 0.15, 0.05]} />
        <meshBasicMaterial color="#ccffff" toneMapped={false} />
      </mesh>
      <mesh position={[-0.6, 0.4, 1.91]}>
        <boxGeometry args={[0.4, 0.15, 0.05]} />
        <meshBasicMaterial color="#ccffff" toneMapped={false} />
      </mesh>

      {/* Brake Lights (Rear) - EMISSIVE when braking */}
      <mesh position={[0.6, 0.4, -1.91]}>
        <boxGeometry args={[0.4, 0.15, 0.05]} />
        <meshStandardMaterial
          color="#550000"
          emissive="#ff0000"
          emissiveIntensity={isBraking ? 5 : 0.5}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-0.6, 0.4, -1.91]}>
        <boxGeometry args={[0.4, 0.15, 0.05]} />
        <meshStandardMaterial
          color="#550000"
          emissive="#ff0000"
          emissiveIntensity={isBraking ? 5 : 0.5}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

// 4. Ambulance with alternating red/blue lights
const Ambulance = ({ position, rotation }) => {
  const red = useRef();
  const blue = useRef();
  useFrame(({ clock }) => {
    const on = Math.sin(clock.elapsedTime * 10) > 0;
    red.current.emissiveIntensity = on ? 5 : 0;
    blue.current.emissiveIntensity = on ? 0 : 5;
  });
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.8, 0.9, 4]} />
        <meshStandardMaterial color="#ffffff" metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.82, 0.3, 4.02]} />
        <meshStandardMaterial color="#ff0000" />
      </mesh>
      <mesh position={[0.5, 1.0, 1.5]}>
        <boxGeometry args={[0.3, 0.2, 0.3]} />
        <meshStandardMaterial ref={red} color="#ff0000" emissive="#ff0000" toneMapped={false} />
      </mesh>
      <mesh position={[-0.5, 1.0, 1.5]}>
        <boxGeometry args={[0.3, 0.2, 0.3]} />
        <meshStandardMaterial ref={blue} color="#0000ff" emissive="#0000ff" toneMapped={false} />
      </mesh>
    </group>
  );
};

// Procedural lit-window texture so the skyline reads as a city at night
const makeWindowTexture = () => {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 12) {
    for (let x = 6; x < 64; x += 14) {
      if (Math.random() < 0.45) {
        g.fillStyle = Math.random() < 0.8 ? '#ffd98a' : '#8ad8ff';
        g.fillRect(x, y, 7, 6);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

const makeBuildings = () => {
  const base = makeWindowTexture();
  const list = [];
  for (let i = 0; i < 36; i++) {
    const x = (Math.random() < 0.5 ? 1 : -1) * (24 + Math.random() * 60);
    const z = (Math.random() < 0.5 ? 1 : -1) * (24 + Math.random() * 60);
    const h = 8 + Math.random() * 22;
    const tex = base.clone();
    tex.needsUpdate = true;
    tex.repeat.set(3, h / 8);
    list.push({ x, z, h, tex });
  }
  return list;
};

const Scenery = () => {
  const [buildings] = useState(makeBuildings);
  return (
    <group>
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[15, b.h, 15]} />
          <meshStandardMaterial color="#14142a" metalness={0.2} roughness={0.8}
            emissive="#ffffff" emissiveMap={b.tex} emissiveIntensity={0.9} />
        </mesh>
      ))}
    </group>
  );
};

// --- SIMULATION (logic lives in sim.js; this just drives it and draws the result) ---
const Simulation = ({ mode, timeScale, onStats }) => {
  const [sim] = useState(() => warmUp(createSim(mode))); // component is remounted (key={mode}) so each run starts fresh
  const [view, setView] = useState({ cars: [], lights: ['red', 'green'] });
  const lastReport = useRef(0);

  useFrame((_, delta) => {
    const s = sim;
    stepSim(s, Math.min(delta, 0.1) * timeScale);
    setView({ cars: s.cars, lights: s.lights });
    if (s.t - lastReport.current > 0.5 * timeScale) {
      lastReport.current = s.t;
      onStats(simStats(s));
    }
  });

  const { cars, lights } = view;
  return (
    <group>
      <TrafficLight position={[-8, 0, 12]} rotation={[0, 0, 0]} state={lights[0]} />
      <TrafficLight position={[8, 0, -12]} rotation={[0, Math.PI, 0]} state={lights[0]} />
      <TrafficLight position={[12, 0, 8]} rotation={[0, -Math.PI / 2, 0]} state={lights[1]} />
      <TrafficLight position={[-12, 0, -8]} rotation={[0, Math.PI / 2, 0]} state={lights[1]} />
      {cars.map((car) => car.type === 'ambulance'
        ? <Ambulance key={car.id} position={car.pos} rotation={car.rot} />
        : <Car key={car.id} position={car.pos} rotation={car.rot} speed={car.speed}
            color={`hsl(${car.hue}, ${car.sat}%, ${car.lum}%)`} />)}
    </group>
  );
};

// --- HUD ---
const ACCENT = { baseline: '#ff5a5a', flux: '#00e676' };

const Segmented = ({ options, value, onChange }) => (
  <div className="seg">
    {options.map(([v, label]) => (
      <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}
        style={value === v && ACCENT[v] ? { background: ACCENT[v], color: '#04110a' } : undefined}>
        {label}
      </button>
    ))}
  </div>
);

const Stat = ({ label, value, unit, color }) => (
  <div className="stat">
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={{ color }}>{value}<span>{unit}</span></div>
  </div>
);

const fmt = (v, digits = 1) => (v == null ? '--' : v.toFixed(digits));

export default function App() {
  const [mode, setMode] = useState('baseline');
  const [timeScale, setTimeScale] = useState(1.0);
  const [stats, setStats] = useState({ avgWait: null, perMin: null, waitingNow: 0 });
  const changeMode = (m) => { setMode(m); setStats({ avgWait: null, perMin: null, waitingNow: 0 }); };

  return (
    <div className="app">
      <aside className="hud">
        <div className="title">
          <span className="dot" />
          <h1>FLUX</h1>
        </div>
        <p className="subtitle">Adaptive traffic signal control</p>

        <Segmented value={mode} onChange={changeMode}
          options={[['baseline', 'Fixed timing'], ['flux', 'Adaptive']]} />
        <Segmented value={timeScale} onChange={setTimeScale}
          options={[[1.0, '1x'], [0.25, 'Slow motion']]} />

        <h2>Live in this scene</h2>
        <div className="grid">
          <Stat label="Avg wait / car" value={fmt(stats.avgWait)} unit="s" color={ACCENT[mode]} />
          <Stat label="Throughput" value={fmt(stats.perMin, 0)} unit="/min" />
          <Stat label="Stopped now" value={stats.waitingNow} unit=" cars" />
        </div>

        <h2>SUMO benchmark (trained PPO)</h2>
        <div className="bench">
          <span>Fixed 38.3 s</span><b>→</b><span className="good">PPO 21.8 s</span>
          <em>-43% average wait</em>
        </div>

        <p className="note">
          An illustration, not the trained model. "Adaptive" here is a simple queue-based rule;
          the benchmark comes from the SUMO simulation in the repo. Switching modes restarts the run.
        </p>
      </aside>

      <Canvas shadows camera={{ position: [60, 65, 60], fov: 35 }} gl={{ toneMapping: THREE.ReinhardToneMapping }}>
        <OrbitControls autoRotate autoRotateSpeed={0.3 * timeScale} maxPolarAngle={Math.PI / 2.1} />
        <ambientLight intensity={0.15} />
        <directionalLight position={[50, 100, -20]} intensity={1} castShadow shadow-bias={-0.0001} />
        <pointLight position={[0, 10, 0]} intensity={0.5} color="#00ccff" />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Environment preset="city" />

        <Road />
        <Scenery />
        <Simulation key={mode} mode={mode} timeScale={timeScale} onStats={setStats} />

        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.4} />
          <Vignette eskil={false} offset={0.1} darkness={0.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
