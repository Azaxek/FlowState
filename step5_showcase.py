import gymnasium as gym
from stable_baselines3 import PPO
import traci
import sumolib
import sys
import os
import time

# Ensure SUMO path
sumo_paths = [
    r"C:\Program Files (x86)\Eclipse\Sumo\bin",
    r"C:\Program Files\Eclipse\Sumo\bin"
]
for path in sumo_paths:
    if os.path.exists(path):
        if path not in os.environ["PATH"]:
            os.environ["PATH"] += os.pathsep + path
        if "SUMO_HOME" not in os.environ:
             os.environ["SUMO_HOME"] = os.path.dirname(path)

from traffic_env import TrafficLightEnv

def run_demo_simulation(env, model=None, label="Simulation"):
    print(f"\nLAUNCHING: {label}")
    print("Look at the SUMO GUI window!")
    print("Press the 'Play' button in SUMO if it doesn't start automatically.")
    
    obs, info = env.reset()
    step = 0
    done = False
    
    # Static Cycle Logic for Baseline
    phase_duration = [30, 3, 30, 3] 
    current_phase_idx = 0
    time_in_phase = 0
    
    while not done:
        # Action Logic
        if model:
            # AI Control
            action, _states = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(action)
            # Add small delay for human watchability if needed, though view.settings handles this
            # time.sleep(0.05) 
        else:
            # Baseline Fixed Control
            tls_id = env.tls_id
            if tls_id:
                if time_in_phase >= phase_duration[current_phase_idx]:
                    current_phase_idx = (current_phase_idx + 1) % 4
                    traci.trafficlight.setPhase(tls_id, current_phase_idx)
                    time_in_phase = 0
                else:
                    time_in_phase += 1
            traci.simulationStep()
            terminated = False
            truncated = False

        step += 1
        
        # Stop after a reasonable time for a demo (e.g., 60 seconds / 600 steps)
        if step >= 600 or traci.simulation.getMinExpectedNumber() <= 0:
            done = True
            
    print(f"{label} Complete.")

if __name__ == "__main__":
    print("="*60)
    print("       FLOWSTATE SHOWCASE DEMO")
    print("="*60)
    print("This script will run two visualizations in the SUMO GUI.")
    print("1. Baseline (Standard Fixed-Time Signal)")
    print("2. FlowState AI (Optimized)")
    print("\nInstructions:")
    print("- When the SUMO window opens, click the green 'Play' button.")
    print("- You can adjust the delay slider in SUMO to speed up/slow down.")
    print("- We recommended recording your screen now if making a video.")
    print("="*60)
    
    input("Press Enter to start Part 1: BASELINE (Expect queues)...")
    
    # Run Baseline
    # Note: TrafficLightEnv doesn't natively support loading a custom view settings file easily via constructor argument 
    # unless we modify it, but we can load it manually via traci if connected, OR better yet,
    # we can trust the user to just watch.
    # Actually, we can pass "--gui-settings-file" to the sumocfg or command.
    # Let's modify the env instantiation to include this if we could, but TrafficLightEnv hardcodes the command.
    # For now, we will rely on standard GUI.
    
    env = TrafficLightEnv(net_file="intersection.net.xml", route_file="traffic.rou.xml", use_gui=True)
    run_demo_simulation(env, model=None, label="Baseline (Fixed Timing)")
    env.close()
    
    print("\n" + "-"*40)
    print("Baseline Demo Finished.")
    input("Press Enter to start Part 2: FLOWSTATE AI (Watch the queues disappear!)...")
    
    env = TrafficLightEnv(net_file="intersection.net.xml", route_file="traffic.rou.xml", use_gui=True)
    model = PPO.load("flowstate_ppo_model")
    run_demo_simulation(env, model=model, label="FlowState AI (Smart Control)")
    env.close()
    
    print("\n" + "="*60)
    print("DEMO COMPLETE")
    print("="*60)
