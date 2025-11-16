"""
Gymnasium environment wrapper for the delivery optimization problem.
"""
import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Optional, Tuple, Dict, Any
from graph import Graph, Order


class DeliveryEnv(gym.Env):
    """
    Gymnasium environment for driver-order allocation optimization.
    
    Observation space: 
    - Driver states (location, has_order, delay, order_pickup_node, order_dropoff_node) for each driver
    - Pending order states (pickup_node, dropoff_node, time_created) for each pending order
    - Graph structure (distance matrix flattened)
    
    Action space:
    - For each pending order, choose a driver to assign (or no driver)
    - Action is a tuple: (order_index, driver_id) where driver_id can be num_drivers for "no assignment"
    """
    
    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": 4}
    
    def __init__(self, graph: Graph, max_pending_orders: int = 10):
        super().__init__()
        self.graph = graph
        self.max_pending_orders = max_pending_orders
        self.num_drivers = graph.num_drivers if graph.num_drivers else 0
        self.num_nodes = graph.num_nodes
        
        # Track episode statistics
        self.episode_delivery_times = []
        self.episode_reward = 0.0
        self.last_delivery_time = 0.0
        
        # Observation space: 
        # - Driver features: location, has_order (0/1), delay, order_pickup_node, order_dropoff_node (5 per driver)
        # - Order features: pickup_node, dropoff_node, time_created, time_waiting (4 per order)
        # - Graph features: distance matrix (num_nodes * num_nodes)
        driver_features = 5
        order_features = 4
        graph_features = self.num_nodes * self.num_nodes
        
        obs_dim = (self.num_drivers * driver_features + 
                  self.max_pending_orders * order_features + 
                  graph_features)
        
        self.observation_space = spaces.Box(
            low=-np.inf, 
            high=np.inf, 
            shape=(obs_dim,), 
            dtype=np.float32
        )
        
        # Action space: Discrete (single integer)
        # Encode (order_index, driver_id) as: action = order_index * (num_drivers + 1) + driver_id
        # order_index: 0 to max_pending_orders-1
        # driver_id: 0 to num_drivers (num_drivers means "no assignment")
        # Total actions: max_pending_orders * (num_drivers + 1)
        # Special case: if no pending orders, action is ignored
        self.action_space = spaces.Discrete(
            self.max_pending_orders * (self.num_drivers + 1)
        )
        
    def _get_observation(self) -> np.ndarray:
        """Extract observation from current graph state."""
        # Ensure graph reference is valid
        if self.graph is None:
            print("ERROR: Graph is None in _get_observation()")
            # Return zero observation
            obs_dim = (self.num_drivers * 5 + 
                      self.max_pending_orders * 4 + 
                      self.num_nodes * self.num_nodes)
            return np.zeros(obs_dim, dtype=np.float32)
        
        obs = []
        
        # Driver features (5 per driver: location, has_order, delay, order_pickup_node, order_dropoff_node)
        for driver in self.graph.drivers:
            obs.append(float(driver.current_node) / self.num_nodes)  # Normalized location
            obs.append(1.0 if driver.order is not None else 0.0)  # Has order
            obs.append(float(driver.delay) / 100.0)  # Normalized delay (assuming max ~100)
            
            if driver.order is not None:
                obs.append(float(driver.order.pickup_node) / self.num_nodes)
                obs.append(float(driver.order.dropoff_node) / self.num_nodes)
            else:
                obs.append(0.0)
                obs.append(0.0)
        
        # Pad driver features if fewer drivers than expected
        while len(obs) < self.num_drivers * 5:
            obs.extend([0.0, 0.0, 0.0, 0.0, 0.0])
        
        # Pending order features (4 per order: pickup_node, dropoff_node, time_created, time_waiting)
        pending_orders = [o for o in self.graph.orders if not o.is_delivered and not o.is_picked_up]
        for i in range(self.max_pending_orders):
            if i < len(pending_orders):
                order = pending_orders[i]
                obs.append(float(order.pickup_node) / self.num_nodes)
                obs.append(float(order.dropoff_node) / self.num_nodes)
                obs.append(float(order.time_created) / 10000.0)  # Normalized time
                obs.append(float(self.graph.timestep - order.time_created) / 100.0)  # Time waiting
            else:
                obs.extend([0.0, 0.0, 0.0, 0.0])  # Padding
        
        # Graph features: distance matrix (flattened and normalized)
        if hasattr(self.graph, 'distance_matrix') and self.graph.distance_matrix is not None:
            # Normalize distances (assuming max distance ~1000)
            dist_matrix = self.graph.distance_matrix.flatten() / 1000.0
            obs.extend(dist_matrix.tolist())
        else:
            # If no distance matrix, use zeros
            obs.extend([0.0] * (self.num_nodes * self.num_nodes))
        
        return np.array(obs, dtype=np.float32)
    
    def _get_pending_orders(self) -> list:
        """Get list of pending orders."""
        return [o for o in self.graph.orders if not o.is_delivered and not o.is_picked_up]
    
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict]:
        """
        Execute one step in the environment.
        
        Args:
            action: Encoded action as single integer
                   Decode: order_index = action // (num_drivers + 1)
                          driver_id = action % (num_drivers + 1)
            
        Returns:
            observation, reward, terminated, truncated, info
        """
        # Ensure graph reference is valid
        if self.graph is None:
            print("ERROR: Environment graph is None in step()")
            obs = self._get_observation()
            return obs, 0.0, True, False, {}
        
        # Decode action: action = order_index * (num_drivers + 1) + driver_id
        driver_options = self.num_drivers + 1  # +1 for "no assignment"
        order_index = int(action) // driver_options
        driver_id = int(action) % driver_options
        
        # Get pending orders
        pending_orders = self._get_pending_orders()
        
        # Debug logging - always show state
        total_orders = len(self.graph.orders) if self.graph else 0
        delivered_orders = sum(1 for o in self.graph.orders if o.is_delivered) if self.graph else 0
        in_transit_orders = sum(1 for o in self.graph.orders if o.is_picked_up and not o.is_delivered) if self.graph else 0
        
        print(f"DEBUG step: action={action}, order_index={order_index}, driver_id={driver_id}, "
              f"pending_orders={len(pending_orders)}, total_orders={total_orders}, "
              f"delivered={delivered_orders}, in_transit={in_transit_orders}")
        
        # Execute action: assign order to driver
        # Check if order_index is valid and driver_id is valid
        if order_index < len(pending_orders) and driver_id < self.num_drivers:
            order = pending_orders[order_index]
            driver = self.graph.drivers[driver_id]
            
            print(f"DEBUG: Assigning order {order.order_id} to driver {driver.driver_id}")
            
            # Assign order to driver (using do_action format)
            assignment_action = {
                'type': 'assign',
                'order_id': order.order_id,
                'driver_id': driver.driver_id
            }
            self.graph.do_action(assignment_action)
            
            # Verify assignment
            if driver.order is not None and driver.order.order_id == order.order_id:
                print(f"DEBUG: Order {order.order_id} successfully assigned to driver {driver.driver_id}")
            else:
                print(f"DEBUG: WARNING - Order assignment may have failed. Driver {driver.driver_id} order: {driver.order.order_id if driver.order else None}")
        else:
            if len(pending_orders) == 0:
                print(f"DEBUG: No pending orders to assign. Action {action} ignored.")
            else:
                print(f"DEBUG: Invalid action - order_index={order_index} (max={len(pending_orders)-1}), driver_id={driver_id} (max={self.num_drivers-1})")
        
        # Store order states before timestep to track newly delivered
        orders_before = {o.order_id: o.is_delivered for o in self.graph.orders}
        
        # Advance simulation by one timestep
        # This creates new orders and moves drivers
        orders_before_count = len(self.graph.orders)
        self.graph.time_step()
        orders_after_count = len(self.graph.orders)
        
        if orders_after_count > orders_before_count:
            print(f"DEBUG: Created {orders_after_count - orders_before_count} new orders. Total orders: {orders_after_count}")
        
        # Calculate reward: negative average delivery time
        # Track newly delivered orders
        reward = 0.0
        for order in self.graph.orders:
            if order.is_delivered and not orders_before.get(order.order_id, False):
                # Order was just delivered
                delivery_time = self.graph.timestep - order.time_created
                self.episode_delivery_times.append(delivery_time)
                # Negative reward proportional to delivery time (normalized)
                reward -= delivery_time / 100.0
        
        # Small negative reward for each timestep to encourage faster delivery
        reward -= 0.01
        
        self.episode_reward += reward
        
        # Check if episode should terminate (optional: after max timesteps)
        terminated = False
        truncated = False
        
        # Get next observation
        obs = self._get_observation()
        
        info = {
            'episode_reward': self.episode_reward,
            'num_delivered': len(self.episode_delivery_times),
            'avg_delivery_time': np.mean(self.episode_delivery_times) if self.episode_delivery_times else 0.0
        }
        
        return obs, reward, terminated, truncated, info
    
    def reset(self, seed: Optional[int] = None, options: Optional[Dict] = None) -> Tuple[np.ndarray, Dict]:
        """Reset the environment."""
        super().reset(seed=seed)
        
        # Reset episode statistics
        self.episode_delivery_times = []
        self.episode_reward = 0.0
        
        # Get initial observation
        obs = self._get_observation()
        info = {}
        
        return obs, info
    
    def render(self):
        """Render the environment (optional)."""
        pass

