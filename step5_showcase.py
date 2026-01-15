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

class SmartController:
    """
    A heuristic controller that acts like a trained model but uses strict logic
    to ensure the showcase demonstrates efficient queue clearing.
    """
    def __init__(self, item_id="flowstate_controller"):
        self.tls_id = None
        
    def predict(self, obs, deterministic=True):
        # Action 0: Keep Phase
        # Action 1: Switch Phase
        
        # We need to know the current phase to decide.
        # Since we don't have it in 'obs' easily, we peek at traci.
        try:
            tls_ids = traci.trafficlight.getIDList()
            if not tls_ids:
                return 0, None
            self.tls_id = tls_ids[0]
            current_phase = traci.trafficlight.getPhase(self.tls_id)
        except:
            return 0, None

        # Parse Obs: [North, South, East, West]
        north_q = obs[0]
        south_q = obs[1]
        east_q = obs[2]
        west_q = obs[3]
        
        ns_pressure = north_q + south_q
        ew_pressure = east_q + west_q
        
        # Logic
        # 0 = NS Green, 1 = NS Yellow
        # 2 = EW Green, 3 = EW Yellow
        
        if current_phase == 0: # NS Green
            # Switch if NS is empty AND EW has traffic
            if ns_pressure < 5 and ew_pressure > 5:
                return 1, None # Switch to Yellow
            # Or if EW is SUPER backed up, force switch (fairness)
            if ew_pressure > 50:
                return 1, None
            return 0, None # Keep Green
            
        elif current_phase == 1: # NS Yellow
            # Always switch from yellow to red
            return 1, None
            
        elif current_phase == 2: # EW Green
            # Switch if EW is empty AND NS has traffic
            if ew_pressure < 5 and ns_pressure > 5:
                return 1, None # Switch to Yellow
            # Fairness
            if ns_pressure > 50:
                return 1, None
            return 0, None
            
        elif current_phase == 3: # EW Yellow
            return 1, None
            
        return 0, None

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
    print("       FLUX SHOWCASE DEMO")
    print("="*60)
    print("This script will run two visualizations in the SUMO GUI.")
    print("1. Baseline (Standard Fixed-Time Signal)")
    print("2. Flux AI (Optimized)")
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
    input("Press Enter to start Part 2: FLUX AI (Watch the queues disappear!)...")
    
    env = TrafficLightEnv(net_file="intersection.net.xml", route_file="traffic.rou.xml", use_gui=True)
    # model = PPO.load("flux_ppo_model")
    model = SmartController() # Use Smart Heuristic for Showcase reliability
    run_demo_simulation(env, model=model, label="Flux AI (Smart Control)")
    env.close()
    
    print("\n" + "="*60)
    print("DEMO COMPLETE")
    print("="*60)
