import os
import sys
import gymnasium as gym
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
from flowstate import config
from flowstate.env import TrafficLightEnv

def train_agent():
    print("Initializing Environment...")
    env = TrafficLightEnv(use_gui=False)
    
    # Check the environment
    print("Checking Environment Compliance...")
    try:
        check_env(env)
        print("Environment is valid.")
    except Exception as e:
        print(f"Environment check failed: {e}")
        # We might continue or exit, but PPO might fail if env is bad
        
    print("Initializing PPO Agent...")
    model = PPO("MlpPolicy", env, verbose=1)
    
    print("Starting Training (50,000 timesteps)...")
    try:
        model.learn(total_timesteps=50000)
        print("Training Finished.")
        
        model.save(config.MODEL_PATH)
        print(f"Model saved to {config.MODEL_PATH}.zip")
        
    except KeyboardInterrupt:
        print("\nTraining interrupted by user. Saving model...")
        model.save(config.MODEL_PATH)
        print(f"Model saved to {config.MODEL_PATH}.zip")
    except Exception as e:
        print(f"Training failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        env.close()

if __name__ == "__main__":
    train_agent()
