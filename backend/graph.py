import numpy as np
import random
import heapq
from collections import deque

class Order:
    
    """
    Represents a single order in the system. An order has a pickup node, a dropoff node, and possibly other attributes
    such as time created, time to deliver, etc.
    """

    current_id = 0

    def __init__(self, pickup_node: int, dropoff_node: int, time_created: int):
        self.order_id = Order.current_id
        Order.current_id += 1
        self.pickup_node = pickup_node
        self.dropoff_node = dropoff_node
        self.time_created = time_created
        self.is_picked_up = False
        self.is_delivered = False

def create_density_field(grid_size=(100, 100), num_blobs=6, seed=None):
    """
    Create a normalized 2D density field on [0,1]^2 as a mixture of Gaussian blobs.
    Returns a (H, W) numpy array with sum = 1.
    """
    if seed is not None:
        rs = np.random.RandomState(seed)
    else:
        rs = np.random

    H, W = grid_size
    ys = np.linspace(0.0, 1.0, H)
    xs = np.linspace(0.0, 1.0, W)
    X, Y = np.meshgrid(xs, ys)
    density = np.zeros_like(X, dtype=float)

    for _ in range(num_blobs):
        cx = rs.rand()
        cy = rs.rand()
        amp = 0.3 + rs.rand() * 1.7
        sx = 0.03 + rs.rand() * 0.18
        sy = 0.03 + rs.rand() * 0.18
        blob = amp * np.exp(-(((X - cx) ** 2) / (2 * sx * sx) + ((Y - cy) ** 2) / (2 * sy * sy)))
        density += blob

    density = np.clip(density, 0.0, None)
    s = density.sum()
    if s <= 0:
        density[:] = 1.0 / (H * W)
    else:
        density /= s
    return density


def sample_points_from_density(density, n_points, seed=None):
    """
    Sample n_points positions in [0,1]^2 according to discrete density (with jitter inside cell).
    Returns numpy array shape (n_points, 2).
    """
    rs = np.random.RandomState(seed)
    H, W = density.shape
    probs = density.ravel()
    probs = probs / probs.sum()
    idx = rs.choice(H * W, size=n_points, replace=True, p=probs)
    rows = idx // W
    cols = idx % W
    ys = (rows + rs.rand(n_points)) / float(H - 1)
    xs = (cols + rs.rand(n_points)) / float(W - 1)
    pts = np.vstack([xs, ys]).T
    return pts


def ensure_connected(edges, pts, num_nodes):
    """
    If graph is disconnected, add minimum edges to connect all components.
    Connects components by shortest distance between their nodes.
    Returns updated edge set.
    """
    # Build adjacency list to check connectivity
    adj_list = {i: set() for i in range(num_nodes)}
    for (a, b) in edges:
        adj_list[a].add(b)
        adj_list[b].add(a)
    
    # Find connected components using BFS
    visited = set()
    components = []
    
    for start in range(num_nodes):
        if start in visited:
            continue
        
        component = set()
        queue = deque([start])
        visited.add(start)
        component.add(start)
        
        while queue:
            node = queue.popleft()
            for neighbor in adj_list[node]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    component.add(neighbor)
                    queue.append(neighbor)
        
        components.append(component)
    
    # If already connected, return edges as is
    if len(components) <= 1:
        return edges
    
    # Connect components by finding closest pairs
    # edges is already a set, but ensure we have a mutable copy
    edge_set = set(edges) if not isinstance(edges, set) else edges.copy()
    while len(components) > 1:
        comp_a = components.pop(0)
        comp_b = components.pop(0)
        
        min_dist = float('inf')
        best_edge = None
        
        for i in comp_a:
            for j in comp_b:
                dist = np.sqrt((pts[i, 0] - pts[j, 0])**2 + (pts[i, 1] - pts[j, 1])**2)
                if dist < min_dist:
                    min_dist = dist
                    best_edge = (min(i, j), max(i, j))
        
        if best_edge:
            edge_set.add(best_edge)
        
        # Merge components
        merged = comp_a | comp_b
        components.append(merged)
    
    return edge_set

           
class Graph:
    """
    Class representing the graph structure of the problem domain.
    """

    def __init__(self, num_nodes: int = 6, num_edges: int = 7, num_drivers: int = None,
                 order_distribution: callable = None, density: float = None, density_noise: float = None, 
                 seed: int = None, order_distribution_type: str = 'mixture'):
        """
        Initalizes the Graph object. The graph should be connected and look somewhat reasonable in 2d space
        since it represents a physical area where drivers and orders are located.
        
        Args:
            order_distribution_type: 'mixture' or 'uniform' - determines how node positions are sampled
            seed: Random seed for reproducibility
        """

        self.num_nodes = num_nodes
        self.num_edges = num_edges
        self.num_drivers = num_drivers
        self.order_distribution = order_distribution
        self.seed = seed
        self.order_distribution_type = order_distribution_type if order_distribution_type else 'mixture'
        
        # Tracking attributes for simulation state
        self.timestep = 0
        self.drivers = []
        self.orders = []
        self.node_positions = None  # Will store 2D positions (num_nodes, 2) in [0,1] range

        self.create_graph()
        self.precompute_matrices()
        
        self.amount_of_orders = self.num_nodes * [0]
        self.drivers_orders = (self.num_drivers * [0]) if self.num_drivers is not None else []

    @staticmethod
    def node_f():
        return random.uniform(0.002,0.1)

    def create_graph(self):
        """
            Function for creating the graph itself using the contructors parameters. 
            Uses geometric graph creation with 2D positions.
        """
        # Initialize adjacency matrix first (needed for all paths)
        self.edges = np.zeros((self.num_nodes, self.num_nodes), dtype=np.int32)
        
        if self.num_nodes <= 0:
            self.nodes = []
            self.node_positions = np.zeros((0, 2))
            return
        
        # Initialize random state
        rs = np.random.RandomState(self.seed)
        
        # Sample node positions
        num_blobs = self.num_nodes // 10 + 2
        grid_size = (100, 100)
        
        if self.order_distribution_type == 'uniform':
            pts = rs.rand(self.num_nodes, 2)
        else:
            # Use mixture density
            density = create_density_field(grid_size=grid_size, num_blobs=num_blobs, seed=self.seed)
            pts = sample_points_from_density(density, self.num_nodes, seed=self.seed)
        
        # Store node positions in [0,1] range
        self.node_positions = pts
        
        # Create nodes
        self.nodes = [self.node_f() for i in range(self.num_nodes)]
        
        if self.num_nodes < 2 or self.num_edges <= 0:
            # Initialize drivers if num_drivers is provided
            if self.num_drivers is not None and self.num_drivers > 0:
                for i in range(self.num_drivers):
                    node_id = i % self.num_nodes
                    driver = Driver(i, node_id, self)
                    self.drivers.append(driver)
            return
        
        # Create edges using k-nearest neighbors approach
        edge_set = set()
        
        for i in range(self.num_nodes):
            # Each node gets a random k between 2 and sqrt(num_nodes)
            k = rs.randint(2, max(3, int(np.sqrt(self.num_nodes)) + 1))
            
            dists_from_i = np.sqrt((pts[i, 0] - pts[:, 0])**2 + (pts[i, 1] - pts[:, 1])**2)
            nearest_k = np.argsort(dists_from_i)[1:k+1]  # exclude self
            
            for j in nearest_k:
                edge_set.add((min(i, j), max(i, j)))
        
        # Randomly remove a fraction of k-nearest edges
        removal_fraction = 0.35
        edge_list_temp = list(edge_set)
        if len(edge_list_temp) > 0:
            edges_to_remove = rs.choice(len(edge_list_temp), 
                                       size=max(0, int(len(edge_list_temp) * removal_fraction)), 
                                       replace=False)
            edge_set = edge_set - set([edge_list_temp[i] for i in edges_to_remove])
        
        # Add random long-distance edges
        num_random_edges = max(1, int(len(edge_set) * 0.10))
        for _ in range(num_random_edges):
            i = rs.randint(0, self.num_nodes)
            j = rs.randint(0, self.num_nodes)
            if i != j:
                edge_set.add((min(i, j), max(i, j)))
        
        # Ensure graph is connected
        edge_set = ensure_connected(edge_set, pts, self.num_nodes)
        
        # Add edges to adjacency matrix with weights (Euclidean distance)
        for a, b in edge_set:
            w = np.sqrt((pts[a, 0] - pts[b, 0])**2 + (pts[a, 1] - pts[b, 1])**2)
            # Round to integer and ensure at least 1
            weight = max(1, int(np.round(w * 10)))  # Scale by 10 to get reasonable integer weights
            self.edges[a, b] = weight
            self.edges[b, a] = weight
        
        # Initialize drivers if num_drivers is provided
        if self.num_drivers is not None and self.num_drivers > 0:
            # Distribute drivers across nodes
            for i in range(self.num_drivers):
                node_id = i % self.num_nodes
                driver = Driver(i, node_id, self)
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
        
        for i, node in enumerate(self.nodes):
            if random.random() < node and self.amount_of_orders[i] < 3:
                self.orders.append(Order(i, random.choice([j for j in range(self.num_nodes) if j != i]), self.timestep))
                self.amount_of_orders[i] += 1

        # Update all drivers and orders
        for driver in self.drivers:
            driver.time_step()

    def get_render_data(self) -> dict:
        """
        Returns data needed for rendering the graph in the frontend. When converting data adjacency matrices need to be converted
        into dictionary most likely.
        
        Note: This method does NOT expose distance_matrix or path_matrix to keep network traffic minimal.
        Path computation for driver routes will be done server-side on-demand (e.g., for mouse hover events).
        """
        # Convert nodes to frontend format
        nodes = []
        for i, node in enumerate(self.nodes):
            # Use stored positions if available, scaled to reasonable pixel coordinates (800x600 default)
            if self.node_positions is not None and len(self.node_positions.shape) == 2 and i < self.node_positions.shape[0]:
                # Scale from [0,1] to pixel coordinates (800x600 canvas)
                x = float(self.node_positions[i, 0] * 800)
                y = float(self.node_positions[i, 1] * 600)
            else:
                # Fallback to 0,0 if positions not available
                x = 0.0
                y = 0.0
            
            nodes.append({
                "id": str(i),
                "position": {"x": x, "y": y},
                "data": {
                    "type": "location",
                    "label": f"Id: {i}",
                    "order_probability": node if node is not None else 0.0
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
            
            # Initialize movement info
            next_node = None
            target_node = None
            edge_weight = None
            progress = None
            
            # If driver has an order, determine target and next node
            if driver.order is not None:
                # Determine target node based on order status
                if driver.order.is_picked_up and not driver.order.is_delivered:
                    target_node = driver.order.dropoff_node
                elif not driver.order.is_picked_up:
                    target_node = driver.order.pickup_node
                else:
                    # Order is delivered, driver should be idle
                    target_node = None
                
                # If driver is moving (delay > 0) and has a target, calculate next node
                if driver.delay > 0 and target_node is not None:
                    # Get next node from path matrix
                    next_node_id = self.path_matrix[driver.current_node, target_node]
                    if next_node_id != -1 and next_node_id < self.num_nodes:
                        next_node = int(next_node_id)
                        # Get edge weight
                        edge_weight = int(self.edges[driver.current_node, next_node])
                        if edge_weight > 0:
                            # Calculate progress along edge (0 = at current node, 1 = at next node)
                            # Progress increases as delay decreases
                            progress = float((edge_weight - driver.delay) / edge_weight)
                            progress = max(0.0, min(1.0, progress))  # Clamp between 0 and 1
            
            drivers.append({
                "id": f"driver-{driver.driver_id}",
                "location": str(driver.current_node),
                "status": status,
                "delay": int(driver.delay),
                "next_node": str(next_node) if next_node is not None else None,
                "target_node": str(target_node) if target_node is not None else None,
                "edge_weight": edge_weight,
                "progress": progress
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

    def get_state_representation(self, order_index) -> np.ndarray:
        """
        Returns a representation of the graph suitable for input to the optimizer.
        """
        return ()

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

class Driver:
    """
    Represents a single driver in the system. A driver has a current location (node), a list of assigned orders, and possibly
    other attributes such as time to next node, etc.
    """

    current_id = 0

    def __init__(self, driver_id: int, current_node: int, graph: Graph):
        self.driver_id = driver_id
        self.current_node = current_node
        self.delay = 0  # time steps until the driver reaches the next node
        self.graph = graph
        self.order: Order = None
        self.id = Driver.current_id
        Driver.current_id += 1

    def time_step(self):
        """
        Advances the driver state by one time step. This may involve moving to the next node, picking up or dropping off orders, etc.
        """

        if self.delay > 0:
            self.delay -= 1
        else:
            if self.order is not None and self.order.is_picked_up and not self.order.is_delivered:
                # Move towards dropoff node
                next_node = self.graph.path_matrix[self.current_node, self.order.dropoff_node]
                if next_node != -1:
                    travel_time = self.graph.edges[self.current_node, next_node]
                    self.delay = travel_time - 1  # Subtract 1 since we move this timestep
                    self.current_node = next_node
                    if self.current_node == self.order.dropoff_node:
                        self.order.is_delivered = True
                        self.graph.drivers_orders[self.id] -= 1
            elif self.order is not None and not self.order.is_picked_up:
                # Move towards pickup node
                next_node = self.graph.path_matrix[self.current_node, self.order.pickup_node]
                if next_node != -1:
                    travel_time = self.graph.edges[self.current_node, next_node]
                    self.delay = travel_time - 1  # Subtract 1 since we move this timestep
                    self.current_node = next_node
                    if self.current_node == self.order.pickup_node:
                        self.order.is_picked_up = True
