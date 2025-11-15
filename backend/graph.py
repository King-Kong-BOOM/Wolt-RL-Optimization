import numpy as np
import random
import heapq

class Driver:
    """
    Represents a single driver in the system. A driver has a current location (node), a list of assigned orders, and possibly
    other attributes such as time to next node, etc.
    """

    def __init__(self, driver_id: int, current_node: int):
        self.driver_id = driver_id
        self.current_node = current_node
        self.delay = 0  # time steps until the driver reaches the next node

    def time_step(self):
        """
        Advances the driver state by one time step. This may involve moving to the next node, picking up or dropping off orders, etc.
        """

        if self.delay > 0:
            self.delay -= 1
        else:
            # Driver is at a node and can take action (pick up/drop off/move)
            pass

class Order:
    
    """
    Represents a single order in the system. An order has a pickup node, a dropoff node, and possibly other attributes
    such as time created, time to deliver, etc.
    """

    def __init__(self, order_id: int, pickup_node: int, dropoff_node: int, time_created: int):
        self.order_id = order_id
        self.pickup_node = pickup_node
        self.dropoff_node = dropoff_node
        self.time_created = time_created
        self.is_picked_up = False
        self.is_delivered = False

class Node:
    """
    Represents a single node in the graph. Node represents a location in the physical area. Each node can create orders
    or have orders to be picked up from it. It is assumed that nodes never create orders from a -> b where a and b are not the same
    location.
    """

    def __init__(self, node_id: int, graph, order_distribution: float = None):
        self.node_id = node_id
        self.graph = graph
        self.order_distribution = order_distribution

    def create_order(self):
        """
        Creates a new order at this node based on the order distribution function.
        """
        pass

    def time_step(self):
        """
        Advances the node state by one time step. This may involve generating new orders, updating existing orders, etc.
        """

        if random.random() < self.order_distribution:
            self.create_order()
            
class Graph:
    """
    Class representing the graph structure of the problem domain.
    """

    def __init__(self, num_nodes: int = 6, num_edges: int = 7, num_drivers: int = None,
                 order_distribution: callable = None, density: float = None, density_noise: float = None):
        """
        Initalizes the Graph object. The graph should be connected and look somewhat reasonable in 2d space
        since it represents a physical area where drivers and orders are located.
        """

        self.num_nodes = num_nodes
        self.num_edges = num_edges
        self.num_drivers = num_drivers
        self.order_distribution = order_distribution
        
        # Tracking attributes for simulation state
        self.timestep = 0
        self.drivers = []
        self.orders = []

        self.create_graph()
        self.precompute_matrices()
        
        pass

    def create_graph(self):
        """
            Function for creating the graph itself using the contructors parameters. Implemented as its own method
            for more readability
        """
        # the node_id of each node is just its index in the self.nodes list
        self.nodes = [Node(i, self, 0.1 if self.order_distribution is None else self.order_distribution(i)) for i in range(self.num_nodes)]
        #all the matrices most likely should be np.darrays 
        self.edges = np.zeros((self.num_nodes, self.num_nodes), dtype=np.int32) # adjancency matrix representing edges between nodes. Weigth 0 means no edge.

        # just temp implementation for testing frontend
        self.edges[0, 1] = 1
        self.edges[1, 0] = 1

        self.edges[2, 4] = 3
        self.edges[4, 2] = 3

        self.edges[5, 1] = 4
        self.edges[1, 5] = 4

        self.edges[3, 2] = 2
        self.edges[2, 3] = 2

        self.edges[4, 1] = 1
        self.edges[1, 4] = 1

        self.edges[5, 3] = 3
        self.edges[3, 5] = 3

        self.edges[0, 5] = 2
        self.edges[5, 0] = 2
        
        # Initialize drivers if num_drivers is provided
        if self.num_drivers is not None and self.num_drivers > 0:
            # Distribute drivers across nodes
            for i in range(self.num_drivers):
                node_id = i % self.num_nodes
                driver = Driver(i, node_id)
                self.drivers.append(driver)
        

    def precompute_matrices(self):
        """
        Precomputes the distance and path matrices using Dijkstra's algorithm.
        
        distance_matrix[i, j] = shortest distance from node i to node j
        path_matrix[i, j] = next node to visit when going from node i to node j (first step in shortest path)
        """
        # Initialize matrices
        self.distance_matrix = np.full((self.num_nodes, self.num_nodes), np.inf, dtype=np.float64)
        self.path_matrix = np.full((self.num_nodes, self.num_nodes), -1, dtype=np.int32)
        
        # Run Dijkstra from each node as source
        for source in range(self.num_nodes):
            # Distance from source to all nodes
            distances = np.full(self.num_nodes, np.inf, dtype=np.float64)
            distances[source] = 0.0
            
            # Previous node in shortest path (for reconstructing first step)
            previous = np.full(self.num_nodes, -1, dtype=np.int32)
            
            # Priority queue: (distance, node)
            pq = [(0.0, source)]
            visited = set()
            
            while pq:
                current_dist, current = heapq.heappop(pq)
                
                # Skip if already visited with shorter distance
                if current in visited:
                    continue
                
                visited.add(current)
                
                # Update distance and path matrices
                self.distance_matrix[source, current] = current_dist
                
                # Set path_matrix for source to current
                if current == source:
                    # Self-loop: path to self is self
                    self.path_matrix[source, current] = current
                elif previous[current] == source:
                    # Direct neighbor: first step is the current node itself
                    self.path_matrix[source, current] = current
                else:
                    # Not direct neighbor: trace back to find first step
                    # The first step is the node immediately after source on the path
                    node = current
                    while previous[node] != source and previous[node] != -1:
                        node = previous[node]
                    # Now node is the first node after source on the path
                    self.path_matrix[source, current] = node
                
                # Explore neighbors
                for neighbor in range(self.num_nodes):
                    if neighbor in visited:
                        continue
                    
                    # Check if edge exists (weight > 0)
                    edge_weight = self.edges[current, neighbor]
                    if edge_weight > 0:
                        new_dist = current_dist + edge_weight
                        
                        # If we found a shorter path
                        if new_dist < distances[neighbor]:
                            distances[neighbor] = new_dist
                            previous[neighbor] = current
                            
                            # Add to priority queue
                            heapq.heappush(pq, (new_dist, neighbor))
        
        # Convert distance_matrix to int32 if all values are integers (for consistency with edges)
        # But keep as float64 to handle potential fractional weights in future
        pass

    def do_action(self, action: np.darray):
        """
        Applies the given action to the graph state. The action is expected to be in a format suitable for the optimizer.
        So the action needs to be decoded here into actual movements or assignments in the graph.
        """

    def time_step(self):
        """
        Advances the graph state by one time step. This may involve updating order locations, driver locations, etc.
        """
        self.timestep += 1
        
        # Update all nodes
        for node in self.nodes:
            node.time_step()
        
        # Update all drivers
        for driver in self.drivers:
            driver.time_step()
        
        pass

    def add_order(self, order: Order):
        """
        Adds a new order to the graph.
        """
        pass


    def get_render_data(self) -> dict:
        """
        Returns data needed for rendering the graph in the frontend. When converting data adjacency matrices need to be converted
        into dictionary most likely.
        
        Note: This method does NOT expose distance_matrix or path_matrix to keep network traffic minimal.
        Path computation for driver routes will be done server-side on-demand (e.g., for mouse hover events).
        """
        # Convert nodes to frontend format
        nodes = []
        for node in self.nodes:
            nodes.append({
                "id": str(node.node_id),
                "position": {"x": 0, "y": 0},  # Frontend will calculate layout
                "data": {
                    "type": "location",
                    "label": f"Node {node.node_id}",
                    "order_probability": float(node.order_distribution) if node.order_distribution is not None else 0.0
                }
            })
        
        # Convert adjacency matrix to edge list
        edges = []
        for i in range(self.num_nodes):
            for j in range(i + 1, self.num_nodes):  # Only process upper triangle to avoid duplicates
                weight = int(self.edges[i, j])
                if weight > 0:  # Only include edges with weight > 0
                    edges.append({
                        "id": f"edge-{i}-{j}",
                        "source": str(i),
                        "target": str(j),
                        "data": {
                            "weight": weight
                        }
                    })
        
        # Convert drivers to frontend format
        drivers = []
        for driver in self.drivers:
            # Determine driver status based on delay
            if driver.delay > 0:
                status = "moving"
            else:
                status = "idle"
            
            drivers.append({
                "id": f"driver-{driver.driver_id}",
                "location": str(driver.current_node),
                "status": status,
                "delay": int(driver.delay)
            })
        
        # Convert orders to frontend format (tasks)
        tasks = []
        for order in self.orders:
            # Determine order status
            if order.is_delivered:
                status = "delivered"
            elif order.is_picked_up:
                status = "in_transit"
            else:
                status = "pending"
            
            # Determine location based on status
            if order.is_delivered:
                location = str(order.dropoff_node)
            elif order.is_picked_up:
                # In transit - location would be driver's location, but for now use pickup node
                location = str(order.pickup_node)
            else:
                location = str(order.pickup_node)
            
            tasks.append({
                "id": f"order-{order.order_id}",
                "status": status,
                "location": location,
                "pickup_node": str(order.pickup_node),
                "dropoff_node": str(order.dropoff_node),
                "time_created": int(order.time_created)
            })
        
        return {
            "timestep": int(self.timestep),
            "nodes": nodes,
            "edges": edges,
            "drivers": drivers,
            "tasks": tasks
        }

    def get_state_representation(self) -> np.ndarray:
        """
        Returns a representation of the graph suitable for input to the optimizer.
        """
        pass

    def compute_driver_path(self, driver_id: int, target_node: int) -> list:
        """
        Computes the path from a driver's current location to a target node.
        This method will be used for server-side path computation when rendering driver paths on hover.
        
        Args:
            driver_id: ID of the driver
            target_node: Target node ID
            
        Returns:
            List of node IDs representing the path from driver's current location to target.
            Returns empty list if path cannot be computed.
        
        Note: This is a placeholder for future implementation. Will use path_matrix or
        compute path using Dijkstra's algorithm when path_matrix is available.
        """
        # TODO: Implement path computation using path_matrix or Dijkstra's algorithm
        # This will be called server-side when frontend requests driver path on hover
        if driver_id < 0 or driver_id >= len(self.drivers):
            return []
        
        driver = self.drivers[driver_id]
        source_node = driver.current_node
        
        if source_node == target_node:
            return [source_node]
        
        # Placeholder: Will use path_matrix when available
        # For now, return empty list
        return []