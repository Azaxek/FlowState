# FlowState

**AI traffic-signal control that learns from a camera feed instead of expensive road sensors.**

FlowState trains a reinforcement-learning agent to run a four-way intersection. In simulation it cut average vehicle wait time by **43%** compared with a standard fixed-timing signal, without reducing how many cars get through.

| Metric (simulated 4-way intersection) | Fixed 30s/3s cycle | FlowState (PPO) | Change |
|---|---|---|---|
| Average wait time | 38.30 s | 21.81 s | **-43.05%** |
| Maximum queue length | - | - | -7.14% |
| CO2 (idle-time estimate) | 24,892,375 mg | 24,535,077 mg | -1.44% |

Raw output is in [`eval_results.txt`](eval_results.txt) and [`eval_advanced.txt`](eval_advanced.txt).

## How it works

```
 SUMO simulation ──> Virtual camera ──> Gymnasium env ──> PPO agent
 (cars, signals)    (counts cars per    (state, reward,   (decides: keep the
                     approach, noisy)    action space)     phase or switch)
```

1. **Simulation.** [SUMO](https://eclipse.dev/sumo/) models a four-way intersection with random (Poisson) traffic: [`intersection.net.xml`](intersection.net.xml), [`traffic.rou.xml`](traffic.rou.xml).
2. **Perception.** [`camera.py`](camera.py) is a virtual camera. It counts vehicles approaching from the North, South, East and West. Five percent Gaussian noise is added so the agent has to cope with imperfect sensing, like a real camera.
3. **Environment.** [`traffic_env.py`](traffic_env.py) wraps the simulation as a Gymnasium environment.
   - Observation: four vehicle counts, one per direction.
   - Action: keep the current signal phase or switch.
   - Reward: negative total waiting time, scaled for stable training.
4. **Agent.** A PPO policy from Stable-Baselines3 ([`step3_train.py`](step3_train.py)). The trained model is saved as [`flux_ppo_model.zip`](flux_ppo_model.zip).

A planned safety layer would sit between the agent and the lights, enforcing minimum green times and pedestrian walk intervals, so the AI can only request changes. The write-up describes this design, and emergency-vehicle priority as future work.

## Run it

You need Python 3.10+ and [SUMO](https://eclipse.dev/sumo/) installed (the scripts look in the default Windows install folders).

```bash
pip install gymnasium stable-baselines3 numpy traci sumolib

python step1_setup.py          # check SUMO and generate traffic
python step2_verify_camera.py  # confirm the virtual camera sees cars
python step3_train.py          # train the PPO agent (about 50,000 steps)
python step4_evaluate.py       # compare against the fixed-time baseline
python step5_showcase.py       # watch the trained agent in the SUMO GUI
```

## 3D visualizer

[`flowstate-visualizer/`](flowstate-visualizer) is a React + Three.js scene that shows cars moving through an intersection, so the idea can be demonstrated without SUMO.

```bash
cd flowstate-visualizer
npm install
npm run dev
```

## Write-ups

- [`Presidential_Challenge_Technical.md`](Presidential_Challenge_Technical.md): architecture, why PPO over DQN, safety design, and results.
- [`Diamond_Challenge_Narrative.md`](Diamond_Challenge_Narrative.md): the problem, the sensor-agnostic business case, and the pitch.

## Tech stack

Python, SUMO / TraCI, Gymnasium, Stable-Baselines3 (PPO), React, Three.js (react-three-fiber)

## Limitations

Results come from simulation of a single intersection, not a deployed system. Real-world use would need real camera input, the safety layer, and validation with traffic engineers.
