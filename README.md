# FlowState

**AI traffic-signal control that learns from a camera feed instead of expensive road sensors.**

FlowState trains a reinforcement-learning agent to run a four-way intersection. In simulation it cut average vehicle wait time by **43%** compared with a standard fixed-timing signal, without reducing how many cars get through.

| Metric (simulated 4-way intersection) | Fixed 30s/3s cycle | FlowState (PPO) | Change |
|---|---|---|---|
| Average wait time | 38.30 s | 21.81 s | **-43.05%** |
| Maximum queue length | - | - | -7.14% |
| CO2 (idle-time estimate) | 24,892,375 mg | 24,535,077 mg | -1.44% |

Raw output is in [`results/`](results).

## How it works

```
 SUMO simulation ──> Virtual camera ──> Gymnasium env ──> PPO agent
 (cars, signals)    (counts cars per    (state, reward,   (decides: keep the
                     approach, noisy)    action space)     phase or switch)
```

1. **Simulation.** [SUMO](https://eclipse.dev/sumo/) models a four-way intersection with random (Poisson) traffic: [`sumo/`](sumo).
2. **Perception.** [`flowstate/camera.py`](flowstate/camera.py) is a virtual camera. It counts vehicles approaching from the North, South, East and West. Five percent Gaussian noise is added so the agent has to cope with imperfect sensing, like a real camera.
3. **Environment.** [`flowstate/env.py`](flowstate/env.py) wraps the simulation as a Gymnasium environment.
   - Observation: four vehicle counts, one per direction.
   - Action: keep the current signal phase or switch.
   - Reward: negative total waiting time, scaled for stable training.
4. **Agent.** A PPO policy from Stable-Baselines3 ([`flowstate/train.py`](flowstate/train.py)). The trained model is saved in [`models/`](models).

A planned safety layer would sit between the agent and the lights, enforcing minimum green times and pedestrian walk intervals, so the AI can only request changes. The write-up describes this design, and emergency-vehicle priority as future work.

## Project layout

```
flowstate/            Python package
  config.py           paths and SUMO setup, shared by everything
  camera.py           virtual camera sensor
  env.py              Gymnasium environment
  generate_scenario.py   build the intersection, traffic and SUMO config
  verify_camera.py    sanity-check the camera readings
  train.py            train the PPO agent
  evaluate.py         compare the agent with the fixed-time baseline
  showcase.py         side-by-side demo in the SUMO GUI
sumo/                 network, routes and config files
models/               trained PPO model
results/              evaluation output
docs/                 competition write-ups
flowstate-visualizer/ React + Three.js demo
```

## Run it

You need Python 3.10+ and [SUMO](https://eclipse.dev/sumo/). On Windows the default install folders are detected automatically; otherwise put SUMO on your `PATH`.

```bash
pip install -r requirements.txt

python -m flowstate.generate_scenario   # optional: regenerate the intersection and traffic
python -m flowstate.verify_camera       # confirm the virtual camera sees cars
python -m flowstate.train               # train the PPO agent (50,000 steps)
python -m flowstate.evaluate            # compare against the fixed-time baseline
python -m flowstate.showcase            # side-by-side demo in the SUMO GUI
```

The showcase uses a simple rule-based controller so the demo is repeatable; the PPO results come from `evaluate`. The "annual impact" figure that `evaluate` prints is an illustrative projection from stated assumptions, not a measurement.

## 3D visualizer

**Live demo:** [azaxek.github.io/FlowState](https://azaxek.github.io/FlowState/)

The scene shows fixed timing against a simple queue-aware controller on identical traffic, with live wait and throughput measured in the scene. It illustrates the idea; it is not the trained PPO model (those results are in the table above).

[`flowstate-visualizer/`](flowstate-visualizer) is a React + Three.js scene that shows cars moving through an intersection, so the idea can be demonstrated without SUMO.

```bash
cd flowstate-visualizer
npm install
npm run dev          # http://localhost:5173
node sim.test.mjs    # headless check: adaptive vs fixed timing in the scene
```

## Write-ups

- [`docs/Presidential_Challenge_Technical.md`](docs/Presidential_Challenge_Technical.md): architecture, why PPO over DQN, safety design, and results.
- [`docs/Diamond_Challenge_Narrative.md`](docs/Diamond_Challenge_Narrative.md): the problem, the sensor-agnostic business case, and the pitch.

## Tech stack

Python, SUMO / TraCI, Gymnasium, Stable-Baselines3 (PPO), React, Three.js (react-three-fiber)

## Limitations

Results come from simulation of a single intersection, not a deployed system. Real-world use would need real camera input, the safety layer, and validation with traffic engineers.
