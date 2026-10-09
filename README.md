# FlowState

AI traffic-signal control that learns from a camera feed instead of expensive road sensors.

FlowState trains a reinforcement-learning agent to run a four-way intersection. In simulation, it cut average vehicle wait time by **43%** compared with a standard fixed-timing signal, without reducing how many cars get through.

| Metric (simulated 4-way intersection) | Fixed 30s/3s cycle | FlowState (PPO) | Change |
|---|---|---|---|
| Average wait time | 38.30 s | 21.81 s | **-43.05%** |
| Maximum queue length | - | - | -7.14% |
| CO2 (idle-time estimate) | 24,892,375 mg | 24,535,077 mg | -1.44% |

Raw output is in [`results/`](results).
