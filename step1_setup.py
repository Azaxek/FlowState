import os
import sys
import subprocess
import random
import traci
import sumolib

# Add common SUMO paths to PATH for this script execution
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
        print(f"Set SUMO_HOME to: {sumo_home}")
        found_sumo = True
        break

if not found_sumo:
    print("Warning: Could not find SUMO in common directories.")


def generate_network():
    print("Generating network file (intersection.net.xml)...")
    # Using netgenerate to create a simple 4-way intersection
    # simple grid with 1 junction means a 4-way intersection if we have incoming/outgoing edges attached,
    # but netgenerate default grid creates a grid.
    # --grid --grid.number=1 --grid.length=100 produces a single node loop? No.
    # --grid --grid.x-number=2 --grid.y-number=2 produces 4 junctions.
    # Actually, a single intersection is best made with 'netgenerate --spider --spider.arm-number=4'
    
    # First generate the geometry (basic spider network)
    # Removing --tls.guess here as it was flaky. We will force it next.
    cmd_gen = ["netgenerate", "--spider", "--spider.arm-number=4", "--output-file=intersection.net.xml", "--no-turnarounds"]
    
    try:
        print("Running netgenerate...")
        subprocess.run(cmd_gen, check=True)
        
        # Now force the central node 'A1' (standard for spider nets) to be a Traffic Light
        print("Forcing Traffic Light on junction A1...")
        cmd_convert = [
            "netconvert", 
            "--sumo-net-file", "intersection.net.xml", 
            "--output-file", "intersection.net.xml",
            "--tls.set", "A1",
            "--tls.green.time", "30",
            "--tls.yellow.time", "3"
        ]
        subprocess.run(cmd_convert, check=True)
        print("Network file generated and TLS forced.")
        
    except FileNotFoundError:

        print("Error: 'netgenerate' command not found. Please ensure SUMO is installed and in your PATH.")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Error generating network: {e}")
        sys.exit(1)

def generate_routes():
    print("Generating route file (traffic.rou.xml)...")
    
    # Load the network to find edge IDs
    try:
        net = sumolib.net.readNet('intersection.net.xml')
        edges = net.getEdges()
        edge_ids = [e.getID() for e in edges]
        # Filter for normal edges (not internal ones starting with :)
        valid_edges = [e for e in edge_ids if not e.startswith(":")]
        print(f"Found valid edges: {valid_edges}")
        
        # Simple heuristic: Routes are usually from one edge to another not connected directly often
        # But for spider network, edges are usually pairs (in/out).
        # Let's just create random routes between any two different valid edges.
        
    except Exception as e:
        print(f"Error reading net file: {e}")
        return

    with open("traffic.rou.xml", "w") as routes:
        print("""<routes>
    <vType id="car" accel="0.8" decel="4.5" sigma="0.5" length="5" minGap="2.5" maxSpeed="16.67" guiShape="passenger"/>""", file=routes)
        
        # Generate random traffic
        for i in range(100):
            # Try to find a valid route
            for attempt in range(100):
                start_edge_id = random.choice(valid_edges)
                end_edge_id = random.choice(valid_edges)
                
                if start_edge_id == end_edge_id:
                    continue
                    
                start_edge = net.getEdge(start_edge_id)
                end_edge = net.getEdge(end_edge_id)
                
                # Check if path exists
                path = net.getShortestPath(start_edge, end_edge)
                if path and len(path[0]) > 0:
                     # path is (edges, cost)
                     full_route_ids = [e.getID() for e in path[0]]
                     route_str = " ".join(full_route_ids)
                     
                     print(f'    <vehicle id="{i}" type="car" depart="{i}">', file=routes)
                     print(f'        <route edges="{route_str}"/>', file=routes)
                     print(f'    </vehicle>', file=routes)
                     break

        
        print("</routes>", file=routes)
    print("Route file generated.")

def generate_config():
    print("Generating configuration file (sumo.sumocfg)...")
    with open("sumo.sumocfg", "w") as cfg:
        print("""<configuration>
    <input>
        <net-file value="intersection.net.xml"/>
        <route-files value="traffic.rou.xml"/>
    </input>
    <time>
        <begin value="0"/>
    </time>
    <report>
        <verbose value="true"/>
        <no-step-log value="true"/>
    </report>
</configuration>""", file=cfg)
    print("Configuration file generated.")

import traceback

def run_simulation():
    print("Starting simulation...")
    
    # Check if sumo is reachable
    try:
        subprocess.run(["sumo", "--version"], check=True)
        print("SUMO valid.")
    except Exception as e:
        print(f"SUMO check failed: {e}")

    try:
        sumoBinary = sumolib.checkBinary('sumo')
    except Exception:
        sumoBinary = 'sumo'

    sumoCmd = [sumoBinary, "-c", "sumo.sumocfg"]
    print(f"Running command: {sumoCmd}")
    
    try:
        traci.start(sumoCmd)
        print("Simulation started.")
        
        for step in range(100):
            traci.simulationStep()
            
        traci.close()
        print("Simulation finished successfully (100 steps run).")
        
    except Exception as e:
        print("Simulation failed.")
        traceback.print_exc()

if __name__ == "__main__":
    generate_network()
    generate_routes()
    generate_config()
    run_simulation()
