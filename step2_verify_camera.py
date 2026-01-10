import os
import sys
import subprocess
import time
import traci
import sumolib

# Add common SUMO paths (copied from step1_setup.py)
sumo_paths = [
    r"C:\Program Files (x86)\Eclipse\Sumo\bin",
    r"C:\Program Files\Eclipse\Sumo\bin"
]
found_sumo = False
for path in sumo_paths:
    if os.path.exists(path):
        os.environ["PATH"] += os.pathsep + path
        # Set SUMO_HOME to the parent directory of bin
        sumo_home = os.path.dirname(path)
        os.environ["SUMO_HOME"] = sumo_home
        found_sumo = True
        break

if not found_sumo:
    print("Warning: Could not find SUMO in common directories. Relying on system PATH.")

# Import the camera class
try:
    from camera import IntersectionCamera
except ImportError:
    print("Error: Could not import IntersectionCamera from camera.py")
    sys.exit(1)

def verify_camera():
    print("Starting Camera Verification...")
    
    # Check binaries
    try:
        sumoBinary = sumolib.checkBinary('sumo')
    except Exception:
        sumoBinary = 'sumo'
        
    sumoCmd = [sumoBinary, "-c", "sumo.sumocfg"]
    print(f"Running command: {sumoCmd}")
    
    try:
        traci.start(sumoCmd)
        print("Simulation started.")
        
        # Initialize Camera
        # Must be done after traci.start so traci methods work? 
        # Actually my camera uses sumolib to read net file, which doesn't require traci.
        # But get_state uses traci.
        camera = IntersectionCamera(net_file="intersection.net.xml", detection_distance=50)
        
        print("\nStep | North | South | East  | West  | Total")
        print("-" * 50)
        
        for step in range(100):
            traci.simulationStep()
            
            # Print state every 10 steps
            if step % 10 == 0:
                state = camera.get_state()
                # state is [N, S, E, W]
                # Format output
                line = f"{step:<4} | {state[0]:<5} | {state[1]:<5} | {state[2]:<5} | {state[3]:<5} | {sum(state):.2f}"
                print(line)
        
        traci.close()
        print("\nVerification finished. Camera successfully generating state vectors.")
        
    except Exception as e:
        print(f"Simulation failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_camera()
