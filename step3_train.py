import os
import sys
import gymnasium as gym
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
from traffic_env import TrafficLightEnv

# Ensure SUMO is in PATH (Redundant check but good for standalone execution)
sumo_paths = [
    r"C:\Program Files (x86)\Eclipse\Sumo\bin",
    r"C:\Program Files\Eclipse\Sumo\bin"
]
found_sumo = False
for path in sumo_paths:
    if os.path.exists(path):
        if path not in os.environ["PATH"]:
            os.environ["PATH"] += os.pathsep + path
        if "SUMO_HOME" not in os.environ:
             os.environ["SUMO_HOME"] = os.path.dirname(path)
        found_sumo = True

if not found_sumo:
    print("Warning: SUMO not found in common directories. Relying on system PATH.")

def train_agent():
    print("Initializing Environment...")
    env = TrafficLightEnv(net_file="intersection.net.xml", route_file="traffic.rou.xml", use_gui=False)
    
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
        
        model.save("flowstate_ppo_model")
        print("Model saved as 'flowstate_ppo_model.zip'.")
        
    except KeyboardInterrupt:
        print("\nTraining interrupted by user. Saving model...")
        model.save("flowstate_ppo_model")
        print("Model saved as 'flowstate_ppo_model.zip'.")
    except Exception as e:
        print(f"Training failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        env.close()

if __name__ == "__main__":
    train_agent()
