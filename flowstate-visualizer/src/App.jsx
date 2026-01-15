import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Float, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

// --- CONFIGURATION ---
const LANE_WIDTH = 4;
const SPAWN_RATE = 0.02;
const CAR_SPEED = 0.25;
const CAR_SPEED_FAST = 0.45; // Faster for "Optimized" feel

// --- COMPONENTS ---

// 1. High-Fidelity Road
const Road = () => {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      {/* Asphalt */}
      <mesh receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#222" roughness={0.95} />
      </mesh>

      {/* Markings - Cross */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[LANE_WIDTH * 2.2, 200]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0, 0, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[LANE_WIDTH * 2.2, 200]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Stop Lines */}
      <mesh position={[0, 11, 0.03]}>
        <planeGeometry args={[LANE_WIDTH * 2, 1]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
      <mesh position={[0, -11, 0.03]}>
        <planeGeometry args={[LANE_WIDTH * 2, 1]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
      <mesh position={[11, 0, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[LANE_WIDTH * 2, 1]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
      <mesh position={[-11, 0, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[LANE_WIDTH * 2, 1]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
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

// 4. Ambulance Component
const Ambulance = ({ position, rotation, speed }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Body */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.8, 0.9, 4]} />
        <meshStandardMaterial color="#ffffff" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* Red Stripe */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.82, 0.3, 4.02]} />
        <meshStandardMaterial color="#ff0000" />
      </mesh>

      {/* Lights - Flashing Blue/Red */}
      <mesh position={[0.5, 1.0, 1.5]}>
        <boxGeometry args={[0.3, 0.2, 0.3]} />
        <meshStandardMaterial
          color="#ff0000"
          emissive="#ff0000"
          emissiveIntensity={Math.sin(Date.now() / 100) > 0 ? 5 : 0}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-0.5, 1.0, 1.5]}>
        <boxGeometry args={[0.3, 0.2, 0.3]} />
        <meshStandardMaterial
          color="#0000ff"
          emissive="#0000ff"
          emissiveIntensity={Math.sin(Date.now() / 100) < 0 ? 5 : 0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

const Scenery = () => {
  const buildings = useMemo(() => {
    const builds = [];
    for (let i = 0; i < 30; i++) {
      // City Grid Logic
      const quadrant = Math.floor(Math.random() * 4);
      const qx = (quadrant < 2 ? 1 : -1);
      const qz = (quadrant % 2 === 0 ? 1 : -1);

      const offset = 25 + Math.random() * 50;
      const x = qx * offset;
      const z = qz * (25 + Math.random() * 50);

      const h = 10 + Math.random() * 30; // Taller buildings

      builds.push(<mesh key={i} position={[x, h / 2, z]} castShadow receiveShadow>
        <boxGeometry args={[15, h, 15]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.2} roughness={0.8} />
        {/* Simple "Window" glow using emissive dots would be expensive, keep simpler */}
      </mesh>)
    }
    return builds;
  }, []);

  return (
    <group>
      {buildings}
      {/* City Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#050510" />
      </mesh>
    </group>
  );
};

// --- LOGIC ---
const Simulation = ({ mode, timeScale }) => {
  const [cars, setCars] = useState([]);
  const [lightStateNS, setLightStateNS] = useState('red');
  const [lightStateEW, setLightStateEW] = useState('green');
  const aiState = useRef({ lastSwitch: 0 });

  useFrame((state, delta) => {
    // FIX: Use Real Delta for Fluidity
    // Clamp delta to prevent "explosions" on lag spikes (e.g. max 0.1s)
    const safeDelta = Math.min(delta, 0.1);
    const dt = safeDelta * timeScale;

    // We still use total elapsed time for light cycles, but we could accumulate if we wanted slow-mo lights.
    // For now, keeping lights loosely sync'd to wall clock is fine, but movement MUST use dt.
    const t = state.clock.getElapsedTime();

    // 0. Check for Emergency Vehicle
    const ambulance = cars.find(c => c.type === 'ambulance');
    const isEmergency = !!ambulance;

    // 1. Lights Logic - Update cycle based on Real Time (t) ? 
    // Actually, if we slow motion, we want lights to slow down too!
    // So we need a custom "simulation time" accumulator.
    // For simplicity, we'll keep lights separate or just accept they might desync visually if using 't'.
    // BETTER approach: Scale the cycle speed variables directly.
    // 1. Lights Logic
    let nsColor = 'red';
    let ewColor = 'green';

    if (isEmergency && mode === 'flux') {
      // PREEMPTION: Force Green for Ambulance
      if (ambulance.lane < 2) { nsColor = 'green'; ewColor = 'red'; }
      else { nsColor = 'red'; ewColor = 'green'; }
      // Reset AI timer so it doesn't switch immediately after
      aiState.current.lastSwitch = t;
    } else if (mode === 'baseline') {
      // BASELINE: Fixed 14s Cycle (Blind Timer)
      const cycle = (t % 14);
      if (cycle < 6) { nsColor = 'green'; ewColor = 'red'; }
      else if (cycle < 7) { nsColor = 'yellow'; ewColor = 'red'; }
      else if (cycle < 13) { nsColor = 'red'; ewColor = 'green'; }
      else { nsColor = 'red'; ewColor = 'yellow'; }
    } else {
      // FLUX AI: Safe Fast Cycle (Green Wave Effect)
      // Reverted sensor logic to ensure continuous flow without deadlocks.
      // 5s Total Cycle: 2s Green, 0.5s Yellow, 2.5s Red
      const cycle = (t % 5);
      if (cycle < 2.0) { nsColor = 'green'; ewColor = 'red'; }
      else if (cycle < 2.5) { nsColor = 'yellow'; ewColor = 'red'; }
      else if (cycle < 4.5) { nsColor = 'red'; ewColor = 'green'; }
      else { nsColor = 'red'; ewColor = 'yellow'; }
    }

    // De-dupe updates to avoid render loop thrashing
    if (lightStateNS !== nsColor) setLightStateNS(nsColor);
    if (lightStateEW !== ewColor) setLightStateEW(ewColor);

    // 2. Spawn Cars - Standard & Random Ambulance
    // If cars move slower, we should spawn them slower to avoid pileups.
    if (Math.random() < (SPAWN_RATE * timeScale)) {
      const lane = Math.floor(Math.random() * 4);
      const isAmbulance = Math.random() < 0.03; // 3% Chance of Ambulance

      const d = 120;
      let pos, rot, dirVec, startLane;

      if (lane === 0) { pos = [-2, 0, -d]; rot = [0, 0, 0]; dirVec = [0, 0, 1]; startLane = 0; } // N->S
      else if (lane === 1) { pos = [2, 0, d]; rot = [0, Math.PI, 0]; dirVec = [0, 0, -1]; startLane = 1; } // S->N
      else if (lane === 2) { pos = [d, 0, -2]; rot = [0, -Math.PI / 2, 0]; dirVec = [-1, 0, 0]; startLane = 2; } // E->W (Faces West)
      else { pos = [-d, 0, 2]; rot = [0, Math.PI / 2, 0]; dirVec = [1, 0, 0]; startLane = 3; } // W->E (Faces East)

      // Spawn Check
      let spawnBlocked = false;
      for (const c of cars) {
        const dx = c.pos[0] - pos[0];
        const dz = c.pos[2] - pos[2];
        if (Math.sqrt(dx * dx + dz * dz) < 15) { spawnBlocked = true; break; }
      }

      if (!spawnBlocked) {
        setCars(prev => [...prev, {
          id: Math.random(),
          type: isAmbulance ? 'ambulance' : 'car',
          lane: startLane, pos, rot, dirVec,
          color: isAmbulance ? '#ffffff' : `hsl(${200 + Math.random() * 40}, ${70 + Math.random() * 20}%, ${50 + Math.random() * 20}%)`, // Varied Cyber colors
          speed: 0,
          speedFactor: 0.9 + Math.random() * 0.2 // +/- 10% Speed Variance
        }]);
      }
    }

    // 3. Move Cars
    setCars(prev => prev.map(car => {
      let nextPos = [...car.pos];

      let baseSpeed = (mode === 'baseline' ? CAR_SPEED : CAR_SPEED_FAST);
      if (car.type === 'ambulance') baseSpeed = 0.65; // Ambulance slightly faster

      // Apply Individual Variance
      // AI Mode: Disable speed variance to ensure perfect "Green Wave" timing.
      // Baseline: Keep variance for chaos.
      const isAI = mode === 'flux';
      const variance = isAI ? 1.0 : (car.speedFactor || 1.0);
      let targetSpeed = baseSpeed * variance;

      // Physics Scaling
      // FIX: Use Real Delta (dt) for fluidity. "speed" variable is units/frame @ 60fps (~16ms).
      // So to maintain behavior, we multiply by (dt / 0.016).
      const FPS_SCALE = dt / 0.016;
      const acceleration = 0.01 * timeScale * FPS_SCALE;
      const braking = 0.08 * timeScale * FPS_SCALE; // Stronger braking for responsiveness

      // Update Speed
      if (car.speed < targetSpeed) car.speed += acceleration;

      let mustStop = false;
      const distToCenter = Math.sqrt(car.pos[0] ** 2 + car.pos[2] ** 2);
      const STOP_LINE_DIST = 12; // Visual stop line location
      const approaching = distToCenter > STOP_LINE_DIST;

      // Traffic Light Stop
      // FIX: "Point of No Return" Logic
      // Visual Stop Line is at 11. Car Front is Center - 1.9.
      // To stop safely before line (Front > 11), Center must be > 12.9.
      // FIX: Robust Stop Logic
      // 1. Detection Zone: When to start checking logic (e.g. 18 units out)
      // 2. Point of No Return: If closer than this (e.g. 14 units) AND moving fast, DON'T stop.
      // 3. Anti-Creep: If we stopped (speed ~0), stay stopped even if past the point.
      const POINT_OF_NO_RETURN = STOP_LINE_DIST + 2.0; // ~14.0
      const DETECTION_ZONE = STOP_LINE_DIST + 7; // ~19

      // FIX: Exit Logic. Only check stop if moving TOWARDS center.
      const isMovingAway = (car.pos[0] * car.dirVec[0] + car.pos[2] * car.dirVec[2]) > 0;

      if (approaching && distToCenter < DETECTION_ZONE && !isMovingAway) {
        const pastPoint = distToCenter < POINT_OF_NO_RETURN;
        const isMovingFast = car.speed > 0.1;

        let light = (car.lane < 2) ? nsColor : ewColor;

        // If we are past the point and moving, we commit to going through.
        if (pastPoint && isMovingFast) {
          mustStop = false;
        } else {
          // Otherwise (before point OR stopped), observe lights
          if (light === 'red') {
            mustStop = true;
          } else if (light === 'yellow') {
            // If yellow and we are capable of stopping safely (before point), stop.
            if (!pastPoint) mustStop = true;
          }
        }

        // Ambulance Override
        if (car.type === 'ambulance') mustStop = false;
      }

      // Car Following Collision Check
      for (const other of prev) {
        if (other.id === car.id) continue;
        if (other.lane !== car.lane) continue;
        const dx = other.pos[0] - car.pos[0];
        const dz = other.pos[2] - car.pos[2];
        const distAhead = dx * car.dirVec[0] + dz * car.dirVec[2];

        if (distAhead > 0 && distAhead < 8) { // 8 units gap
          mustStop = true;
          break;
        }
      }

      if (mustStop) {
        car.speed = Math.max(0, car.speed - braking);
      }

      // Apply movement scaled by timeScale (and simplified by FPS_SCALE for speed var compatibility)
      // car.speed is units per frame(@60fps). 
      // moveStep = car.speed * FPS_SCALE; 
      // dt includes timeScale already. So FPS_SCALE includes timeScale.
      const moveStep = car.speed * FPS_SCALE;

      nextPos[0] += car.dirVec[0] * moveStep;
      nextPos[2] += car.dirVec[2] * moveStep;

      if (distToCenter > 130 && !approaching) return null;
      return { ...car, pos: nextPos };
    }).filter(c => c !== null));
  });

  return (
    <group>
      {/* Lights - Rotated carefully to face oncoming traffic */}
      <TrafficLight position={[-8, 0, 12]} rotation={[0, 0, 0]} state={lightStateNS} /> {/* Faces N traffic */}
      <TrafficLight position={[8, 0, -12]} rotation={[0, Math.PI, 0]} state={lightStateNS} /> {/* Faces S traffic */}
      <TrafficLight position={[12, 0, 8]} rotation={[0, -Math.PI / 2, 0]} state={lightStateEW} /> {/* Faces E traffic */}
      <TrafficLight position={[-12, 0, -8]} rotation={[0, Math.PI / 2, 0]} state={lightStateEW} /> {/* Faces W traffic */}

      {cars.map(car => (
        car.type === 'ambulance' ?
          <Ambulance key={car.id} position={car.pos} rotation={car.rot} speed={car.speed} /> :
          <Car key={car.id} position={car.pos} rotation={car.rot} color={car.color} speed={car.speed} />
      ))}
    </group>
  );
};

export default function App() {
  const [mode, setMode] = useState('baseline');
  const [timeScale, setTimeScale] = useState(1.0); // 1.0 = Regular, 0.1 = SlowMo

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505', fontFamily: "'Inter', sans-serif" }}>

      {/* HUD DASHBOARD */}
      <div style={{
        position: 'absolute', top: 30, left: 30, zIndex: 10,
        background: 'rgba(20, 20, 30, 0.6)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '24px',
        color: 'white',
        width: '320px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00ffcc', boxShadow: '0 0 10px #00ffcc', marginRight: '10px' }}></div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', letterSpacing: '-0.5px' }}>FLUX</h1>
        </div>

        <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#889' }}>INTELLIGENT TRAFFIC CONTROL SYSTEM</p>

        {/* Toggle Pill */}
        <div style={{ background: '#111', borderRadius: '8px', padding: '4px', display: 'flex', marginBottom: '16px' }}>
          <button onClick={() => setMode('baseline')} style={{
            flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
            background: mode === 'baseline' ? '#ff3333' : 'transparent',
            color: mode === 'baseline' ? '#fff' : '#666', fontWeight: '600', transition: '0.3s'
          }}>BASELINE</button>
          <button onClick={() => setMode('flux')} style={{
            flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
            background: mode === 'flux' ? '#00e676' : 'transparent',
            color: mode === 'flux' ? '#000' : '#666', fontWeight: '600', transition: '0.3s'
          }}>AI OPTIMIZED</button>
        </div>

        {/* SLOW MO TOGGLE */}
        <div style={{ background: '#111', borderRadius: '8px', padding: '4px', display: 'flex', marginBottom: '24px' }}>
          <button onClick={() => setTimeScale(1.0)} style={{
            flex: 1, padding: '6px', border: 'none', borderRadius: '4px', cursor: 'pointer',
            background: timeScale === 1.0 ? '#444' : 'transparent',
            color: timeScale === 1.0 ? '#fff' : '#666', fontSize: '0.8rem', fontWeight: '600'
          }}>1x SPEED</button>
          <button onClick={() => setTimeScale(0.1)} style={{
            flex: 1, padding: '6px', border: 'none', borderRadius: '4px', cursor: 'pointer',
            background: timeScale === 0.1 ? '#00ccff' : 'transparent',
            color: timeScale === 0.1 ? '#fff' : '#666', fontSize: '0.8rem', fontWeight: '600'
          }}>🐢 SLOW MO</button>
        </div>



        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.7rem', color: '#aaa', marginBottom: '4px' }}>AVG WAIT TIME</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: mode === 'flux' ? '#00e676' : '#ff3333' }}>
              {mode === 'baseline' ? '38.3s' : '21.8s'}
            </div>
            {mode === 'flux' && <div style={{ fontSize: '0.7rem', color: '#00e676' }}>▼ 43% IMPROVEMENT</div>}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.7rem', color: '#aaa', marginBottom: '4px' }}>THROUGHPUT</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff' }}>
              {mode === 'baseline' ? '80/m' : '100/m'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#889' }}>VEHICLES PER MIN</div>
          </div>
        </div>
      </div>

      <Canvas shadows camera={{ position: [40, 50, 40], fov: 35 }} gl={{ toneMapping: THREE.ReinhardToneMapping }}>
        {/* Controls */}
        <OrbitControls autoRotate={true} autoRotateSpeed={0.3 * timeScale} maxPolarAngle={Math.PI / 2.1} />

        {/* Cinema Lighting */}
        <ambientLight intensity={0.1} />
        <directionalLight position={[50, 100, -20]} intensity={1} castShadow shadow-bias={-0.0001} />
        <pointLight position={[0, 10, 0]} intensity={0.5} color="#00ccff" /> {/* City Ambience */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Environment preset="city" />

        {/* Scene */}
        <Road />
        <Scenery />
        <Simulation mode={mode} timeScale={timeScale} />

        {/* Post Processing - The "Blender" Look */}
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.4} />
          <Vignette eskil={false} offset={0.1} darkness={0.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
