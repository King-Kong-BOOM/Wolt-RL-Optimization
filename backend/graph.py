import numpy as np

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