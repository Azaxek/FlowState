import traci

from stable_baselines3 import PPO

from flowstate import config
from flowstate.env import TrafficLightEnv

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
    print("2. FlowState (trained PPO agent)")
    print("\nInstructions:")
    print("- When the SUMO window opens, click the green 'Play' button.")
    print("- You can adjust the delay slider in SUMO to speed up/slow down.")
    print("- We recommend recording your screen now if making a video.")
    print("="*60)
    
    input("Press Enter to start Part 1: BASELINE (Expect queues)...")
    
    env = TrafficLightEnv(use_gui=True)
    run_demo_simulation(env, model=None, label="Baseline (Fixed Timing)")
    env.close()
    
    print("\n" + "-"*40)
    print("Baseline Demo Finished.")
    input("Press Enter to start Part 2: FLOWSTATE PPO agent (watch the queues clear)...")
    
    env = TrafficLightEnv(use_gui=True)
    model = PPO.load(config.MODEL_PATH)
    run_demo_simulation(env, model=model, label="FlowState (PPO agent)")
    env.close()
    
    print("\n" + "="*60)
    print("DEMO COMPLETE")
    print("="*60)
