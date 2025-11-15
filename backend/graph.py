import numpy as np

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

    def __init__(self, node_id: int, graph, order_distribution: callable = None):
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
        
        if self.order_distribution:
            pass

class Graph:
    """
    Class representing the graph structure of the problem domain.
    """

    def __init__(self, num_nodes: int = None, num_edges: int = None, num_drivers: int = None,
                 order_distribution: callable = None, density: float = None, density_noise: float = None):
        """
        Initalizes the Graph object. The graph should be connected and look somewhat reasonable in 2d space
        since it represents a physical area where drivers and orders are located.
        """
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

        pass

    def add_order(self, order: Order):
        """
        Adds a new order to the graph.
        """
        pass


    def get_render_data(self) -> dict: # not sure if this sould be seriazlized here or in the route
        """
        Returns data needed for rendering the graph in the frontend.
        """
        pass

    def get_state_representation(self) -> np.ndarray:
        """
        Returns a representation of the graph suitable for input to the optimizer.
        """
        pass