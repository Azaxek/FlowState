import gymnasium as gym
from gymnasium import spaces
import numpy as np
import os
import traci
import sumolib

from flowstate import config
from flowstate import conditions
from flowstate.camera import IntersectionCamera

class TrafficLightEnv(gym.Env):
    """
    Custom Environment that follows gymnasium interface.
    """
    metadata = {'render_modes': ['human']}

    def __init__(self, net_file=config.NET_FILE, route_file=config.ROUTE_FILE, use_gui=False, detection_dist=50,
                 condition=None, randomize=False, sumo_seed=None):
        super(TrafficLightEnv, self).__init__()
        
        self.net_file = net_file
        self.route_file = route_file
        self.use_gui = use_gui
        self.detection_dist = detection_dist
        # condition: fixed operating conditions (see conditions.py); randomize: new random ones every episode
        self.condition = condition or conditions.DEFAULT
        self.randomize = randomize
        self.sumo_seed = sumo_seed  # fixed SUMO seed for repeatable evaluation runs
        
        # Define Action Space:
        # 0: Keep current phase
        # 1: Switch to next phase
        self.action_space = spaces.Discrete(2)
        
        # Define Observation Space:
        # [North, South, East, West] density/count
        # Using a Box space with adequate bounds.
        self.observation_space = spaces.Box(low=0, high=100, shape=(4,), dtype=np.float32)
        
        self.camera = None
        self.sumo_process = None
        self.tls_id = None # Traffic Light ID
        
        config.ensure_sumo_on_path()

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        cond = conditions.sample(self.np_random) if self.randomize else self.condition
        if options and options.get('condition'):
            cond = options['condition']
        self.active_condition = cond
        
        # Close existing simulation if running
        try:
            traci.close()
        except Exception:
            pass

        # Start SUMO
        sumoBinary = "sumo-gui" if self.use_gui else "sumo"
        try:
            # Check if binary exists
            sumolib.checkBinary(sumoBinary)
        except Exception:
            # Fallback to 'sumo' if sumo-gui not found or vice versa?
            # Or just assume 'sumo' is in path if checkBinary fails locally
            if self.use_gui:
                sumoBinary = "sumo" # Fallback
            else:
                 pass # let it crash or rely on path

        # Generate config on the fly? Or expect it to exist.
        # We rely on sumo.sumocfg existing or we can pass args directly.
        # Let's pass args directly to be safe/flexible.
        
        sumo_cmd = [
            sumoBinary,
            "-n", self.net_file,
            "-r", self.route_file,
            "--no-step-log", "true",
            "--waiting-time-memory", "1000",
            "--time-to-teleport", "-1" # Disable teleport for accurate waiting time
        ]
        if cond.scale != 1.0:
            sumo_cmd.extend(["--scale", str(cond.scale)])
        if self.sumo_seed is not None:
            sumo_cmd.extend(["--seed", str(self.sumo_seed)])
        elif self.randomize or seed is not None:
            sumo_cmd.extend(["--seed", str(int(self.np_random.integers(1, 2**31 - 1)))])
        
        if self.use_gui and os.path.exists(config.VIEW_SETTINGS):
            sumo_cmd.extend(["--gui-settings-file", config.VIEW_SETTINGS])
        
        try:
            traci.start(sumo_cmd)
        except Exception as e:
            print(f"Error starting SUMO: {e}")
            raise e
            
        # Initialize Camera
        # Note: Camera init reads net file, so it doesn't depend on traci connection 
        # but get_state does.
        if self.camera is None:
             self.camera = IntersectionCamera(net_file=self.net_file, detection_distance=50)

        self._apply_condition(cond)

        # Get Traffic Light ID
        # Assume there is one TLS in the network
        tls_ids = traci.trafficlight.getIDList()
        if tls_ids:
            self.tls_id = tls_ids[0]
        else:
            print("Warning: No traffic light found in network.")
            self.tls_id = None
            
        # Run a few steps to populate the road
        for _ in range(5):
             traci.simulationStep()
             
        observation = self._get_obs()
        info = {}
        
        return observation, info

    def _apply_condition(self, cond):
        """Apply driving behaviour and camera settings for this episode."""
        traci.vehicletype.setMaxSpeed("car", 16.67 * cond.speed_factor)
        traci.vehicletype.setAccel("car", 0.8 * cond.accel_factor)
        traci.vehicletype.setDecel("car", 4.5 * cond.decel_factor)
        traci.vehicletype.setImperfection("car", cond.sigma)
        traci.vehicletype.setTau("car", cond.tau)
        self.camera.detection_distance = cond.detection_dist
        self.camera.noise_std = cond.noise_std
        self.camera.miss_rate = cond.miss_rate
        self.camera.rng.seed(int(self.np_random.integers(0, 2**31 - 1)))

    def _get_obs(self):
        state = self.camera.get_state()
        return np.array(state, dtype=np.float32)

    def step(self, action):
        # Apply Action
        if self.tls_id:
            if action == 1:
                # Switch phase
                # Simple logic: advance to next phase. 
                # In SUMO, we can interpret 'next phase' as green for next direction.
                # Or simply increment phase index.
                current_phase = traci.trafficlight.getPhase(self.tls_id)
                # Assuming simple setup: 0=NS Green, 1=NS Yellow, 2=EW Green, 3=EW Yellow
                # Or generated by netgenerate: usually index increments.
                
                # To make it robust: set phase to (current + 1) % distinct_phases
                # But switching immediately might be jarring.
                # Let's just create a logical switch:
                # If we want to switch, we trigger a phase change.
                # But 'Action 1' usually means 'Change NOW'.
                
                next_phase = (current_phase + 1) % 4 # Assuming 4 phases standard
                
                # However, we must preserve yellow light logic if we want realism.
                # For this simplified prompt: "Switch to next phase".
                traci.trafficlight.setPhase(self.tls_id, next_phase)
            else:
                # Action 0: Keep phase.
                # Do we need to extend the duration?
                # traci.trafficlight.setPhaseDuration(self.tls_id, 1000) # Extend
                pass

        # Run Simulation Step
        # The agent decides every step? Or every few seconds?
        # Usually RL agents act every 5-10 seconds to allow traffic to clear.
        # But for "50,000 timesteps", if we step every 1s, that's fine.
        
        traci.simulationStep()
        
        # Calculate Reward
        # "Negative sum of squares of waiting times"
        # Waiting time: accumulated waiting time of all vehicles
        
        reward = 0
        # Get all edge IDs
        edge_ids = traci.edge.getIDList()
        total_waiting_time = 0
        
        for edge_id in edge_ids:
            # Skip internal edges
            if edge_id.startswith(":"):
                continue
            wt = traci.edge.getWaitingTime(edge_id)
            total_waiting_time += wt
            
        # Reward: Minimize Total Waiting Time (Linear) for maximum efficiency/throughput
        # Scale by 0.01 to keep reward magnitudes manageable for PPO
        reward = -total_waiting_time * 0.01
        
        # Get Observation
        observation = self._get_obs()
        
        # Check Done
        # We can set a max step limit here or in the wrapper.
        # SUMO simulation automatically ends when vehicles are exhausted if configured,
        # but for RL we usually want fixed episode length.
        terminated = False
        truncated = False
        if traci.simulation.getMinExpectedNumber() <= 0:
             terminated = True
             
        info = {}
        
        return observation, reward, terminated, truncated, info

    def close(self):
        try:
            traci.close()
        except Exception:
            pass
