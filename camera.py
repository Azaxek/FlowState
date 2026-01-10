import random
import traci
import sumolib
import math

class IntersectionCamera:
    def __init__(self, net_file="intersection.net.xml", detection_distance=50):
        self.detection_distance = detection_distance
        self.directions = ["North", "South", "East", "West"]
        self.lane_map = {d: [] for d in self.directions}
        
        # Parse net to find incoming lanes and classify them
        try:
            net = sumolib.net.readNet(net_file)
        except Exception as e:
            print(f"Error reading net file {net_file}: {e}")
            return

        # Find the central junction (node with most edges or simply the one connecting our arms)
        # In a spider net with arm-number=4, there is one center junction.
        nodes = net.getNodes()
        junction = None
        for n in nodes:
            # The center node usually has incoming edges from all directions
            if len(n.getIncoming()) >= 3:
                junction = n
                break
        
        if not junction:
            print("Error: Could not find central junction in network.")
            return

        print(f"Intersection Camera initialized at junction: {junction.getID()}")


        for edge in junction.getIncoming():
            # Get angle of the edge (direction of traffic flow)
            # sumolib Edge doesn't have getAngle(), calculate from shape or nodes.
            # edge.getShape() returns [(x1,y1), (x2,y2), ...]
            shape = edge.getShape()
            if not shape or len(shape) < 2:
                continue
                
            # Vector from start to end of the edge (or last segment)
            p1 = shape[-2]
            p2 = shape[-1]
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            
            # Angle in degrees, 0 is North in SUMO? No, standard math 0 is East.
            # SUMO Setup:
            # 0 is North, 90 is East usually for "Heading".
            # Math atan2: 0 is East (positive X), 90 is North (positive Y).
            # Let's adjust.
            math_angle = math.degrees(math.atan2(dy, dx))
            # math_angle: 0=East, 90=North, 180=West, -90=South.
            
            # Convert to 0-360 range
            if math_angle < 0:
                math_angle += 360
                
            # Map to SUMO-like cardinal directions based on FLOW direction
            # Flowing South: dy < 0, dx ~ 0. math_angle ~ 270 (-90).
            # Flowing North: dy > 0, dx ~ 0. math_angle ~ 90.
            # Flowing East: dy ~ 0, dx > 0. math_angle ~ 0.
            # Flowing West: dy ~ 0, dx < 0. math_angle ~ 180.
            
            direction = None
            if 225 <= math_angle < 315:
                direction = "North" # Flowing South (approx 270 math deg)
            elif 45 <= math_angle < 135:
                direction = "South" # Flowing North (approx 90 math deg)
            elif 315 <= math_angle or math_angle < 45:
                direction = "West" # Flowing East (approx 0 math deg) wait...
                # If I am on the West side, flowing East -> My origin is West.
                # "West incoming" means "Incoming FROM West".
                # Flow is East. (0 deg).
                # So math_angle ~ 0 => West Lane.
            elif 135 <= math_angle < 225:
                direction = "East" # Flowing West (approx 180 math deg, Incoming FROM East)
            
            # Recheck:
            # Incoming FROM North: Flows South. dy=-, dx=0. atan2( -1, 0) = -90 = 270. -> Matches "North" block.
            # Incoming FROM South: Flows North. dy=+, dx=0. atan2( 1, 0) = 90. -> Matches "South" block.
            # Incoming FROM East: Flows West. dy=0, dx=-1. atan2( 0, -1) = 180. -> Matches "East" block.
            # Incoming FROM West: Flows East. dy=0, dx=1. atan2( 0, 1) = 0. -> Matches "West" block (315-45).
            
            # Assigning
            angle = math_angle 
                
            if direction:
                lanes = edge.getLanes()
                lane_ids = [l.getID() for l in lanes]
                self.lane_map[direction].extend(lane_ids)
                print(f"Mapped lanes {lane_ids} to direction {direction} (Angle: {angle:.1f})")

    def get_state(self):
        """
        Returns a state vector: [North_Density, South_Density, East_Density, West_Density].
        Counts cars within detection_distance of the stop bar.
        Adds 5% Gaussian noise.
        """
        state = []
        for d in self.directions:
            count = 0
            for lane_id in self.lane_map[d]:
                try:
                    # Get length of lane
                    length = traci.lane.getLength(lane_id)
                    # Get vehicles on lane
                    vehs = traci.lane.getLastStepVehicleIDs(lane_id)
                    
                    for veh in vehs:
                        try:
                            pos = traci.vehicle.getLanePosition(veh)
                            # Stop bar is at the end of the lane (pos = length)
                            # Distance to stop bar = length - pos
                            if (length - pos) <= self.detection_distance:
                                count += 1
                        except traci.exceptions.TraCIException:
                            # Vehicle might have moved or disappeared
                            pass
                except traci.exceptions.TraCIException as e:
                    print(f"Error accessing lane {lane_id}: {e}")
            
            # Add 5% Gaussian noise
            # Interpreting "5% Gaussian noise" as noise with std_dev = 0.05 * count
            # This makes the error proportional to the count.
            if count > 0:
                noise = random.gauss(0, 0.05 * count)
                count += noise
            
            # Ensure non-negative
            count = max(0.0, count)
            
            # Rounding to 2 decimal places for cleaner output
            state.append(round(count, 2))
            
        return state
