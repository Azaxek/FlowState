"""Stress-test the fixed-time baseline and the PPO model(s) under each named condition
(see conditions.py), averaged over several seeds. If a robust model has been trained with
train_robust.py it is included as a third column.

    python -m flowstate.evaluate_robust [seeds]
"""
import os
import sys

import numpy as np
from stable_baselines3 import PPO

from flowstate import config, conditions
from flowstate.env import TrafficLightEnv
from flowstate.evaluate import run_simulation_metrics
from flowstate.train_robust import ROBUST_MODEL_PATH


def avg_wait(model, cond, seed):
    env = TrafficLightEnv(condition=cond, sumo_seed=seed)
    env.reset(seed=seed)  # seeds the camera noise; run_simulation_metrics resets again without reseeding
    wait = run_simulation_metrics(env, model=model, label=f"seed {seed}")[0]
    env.close()
    return wait


def main(n_seeds=3):
    models = {"fixed": None, "original": PPO.load(config.MODEL_PATH)}
    if os.path.exists(ROBUST_MODEL_PATH + ".zip"):
        models["robust"] = PPO.load(ROBUST_MODEL_PATH)
    cols = list(models)

    print("Average wait per step (lower is better), mean of %d seeds" % n_seeds)
    print(f"{'Condition':<24}" + "".join(f"{c.title():>10}" for c in cols) + "".join(f"{c + ' vs fixed':>20}" for c in cols[1:]))
    for name, cond in conditions.NAMED.items():
        res = {c: float(np.mean([avg_wait(m, cond, s) for s in range(1, n_seeds + 1)])) for c, m in models.items()}
        gains = [(res["fixed"] - res[c]) / res["fixed"] * 100 for c in cols[1:]]
        print(f"{name:<24}" + "".join(f"{res[c]:>10.2f}" for c in cols) + "".join(f"{g:>+19.1f}%" for g in gains), flush=True)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 3)
