"""Train a PPO agent under randomized sensor and driving conditions (see conditions.py).

Saved separately from the benchmark model so the original results stay reproducible:
    python -m flowstate.train_robust [timesteps]
"""
import sys

from stable_baselines3 import PPO

from flowstate import config
from flowstate.env import TrafficLightEnv

ROBUST_MODEL_PATH = config.MODEL_PATH.replace("flowstate_ppo_model", "flowstate_ppo_robust")


def train(timesteps=200_000, seed=0):
    env = TrafficLightEnv(randomize=True)
    model = PPO("MlpPolicy", env, verbose=0, seed=seed)
    try:
        model.learn(total_timesteps=timesteps)
    finally:
        model.save(ROBUST_MODEL_PATH)
        env.close()
    print(f"Saved {ROBUST_MODEL_PATH}.zip after {timesteps} steps")


if __name__ == "__main__":
    train(int(sys.argv[1]) if len(sys.argv) > 1 else 200_000)
