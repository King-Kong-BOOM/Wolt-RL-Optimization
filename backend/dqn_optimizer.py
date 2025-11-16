"""
DQN Optimizer using Stable Baselines 3 for driver-order allocation.
"""
import numpy as np
from typing import Optional, Dict, Any
from stable_baselines3 import DQN
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.logger import configure
import os
from graph import Graph
from rl_environment import DeliveryEnv
from optimizer import Optimizer


class TrainingCallback(BaseCallback):
    """Callback for tracking training progress."""
    
    def __init__(self, verbose=0):
        super().__init__(verbose)
        self.episode_rewards = []
        self.episode_lengths = []
        self.avg_delivery_times = []
    
    def _on_step(self) -> bool:
        # Log episode statistics if available
        if 'episode' in self.locals.get('infos', [{}])[0]:
            episode_info = self.locals['infos'][0].get('episode', {})
            if episode_info:
                self.episode_rewards.append(episode_info.get('r', 0))
                self.episode_lengths.append(episode_info.get('l', 0))
                if 'avg_delivery_time' in self.locals['infos'][0]:
                    self.avg_delivery_times.append(self.locals['infos'][0]['avg_delivery_time'])
        return True


class DQNOptimizer(Optimizer):
    """
    DQN-based optimizer for driver-order allocation.
    Uses Stable Baselines 3 DQN algorithm.
    """
    
    def __init__(self, graph: Optional[Graph] = None, model_path: Optional[str] = None):
        super().__init__()
        self.graph = graph
        self.model: Optional[DQN] = None
        self.env: Optional[DeliveryEnv] = None
        self.model_path = model_path or "models/dqn_delivery_model"
        self.training_callback = TrainingCallback()
        
        # Create environment if graph is provided
        if graph is not None:
            self.env = DeliveryEnv(graph)
            # Initialize model if path exists, otherwise create new
            if model_path and os.path.exists(f"{model_path}.zip"):
                self.model = DQN.load(model_path, env=self.env)
                print(f"Loaded DQN model from {model_path}")
            else:
                # Create new DQN model
                self.model = DQN(
                    "MlpPolicy",
                    self.env,
                    learning_rate=1e-4,
                    buffer_size=100000,
                    learning_starts=1000,
                    batch_size=32,
                    tau=1.0,
                    gamma=0.99,
                    train_freq=(4, "step"),
                    gradient_steps=1,
                    target_update_interval=1000,
                    exploration_fraction=0.1,
                    exploration_initial_eps=1.0,
                    exploration_final_eps=0.05,
                    max_grad_norm=10,
                    verbose=1
                )
                print("Created new DQN model")
    
    def get_action(self, graph: Graph) -> np.ndarray:
        """
        Get action from the DQN agent for the current graph state.
        
        Returns:
            Action as numpy array [order_index, driver_id] for compatibility with do_action
            or None if no pending orders
        """
        if self.model is None or self.env is None:
            return None
        
        # Update environment's graph reference
        self.env.graph = graph
        
        # Get observation
        obs = self.env._get_observation()
        
        # Get action from model (deterministic for evaluation)
        # Action is now a single integer (Discrete action space)
        action_int, _ = self.model.predict(obs, deterministic=True)
        
        # Decode action: action = order_index * (num_drivers + 1) + driver_id
        driver_options = self.env.num_drivers + 1
        order_index = int(action_int) // driver_options
        driver_id = int(action_int) % driver_options
        
        # Return as array for compatibility with do_action
        return np.array([order_index, driver_id])
    
    def train_step(self, graph: Graph):
        """
        Perform one training step.
        This is called during the simulation loop when training mode is enabled.
        """
        if self.model is None or self.env is None:
            return
        
        # Update environment's graph reference
        self.env.graph = graph
        
        # Get current observation
        obs = self.env._get_observation()
        
        # Get pending orders
        pending_orders = self.env._get_pending_orders()
        
        if len(pending_orders) > 0:
            # Sample action from model (with exploration)
            action, _ = self.model.predict(obs, deterministic=False)
            
            # Execute action in environment
            new_obs, reward, terminated, truncated, info = self.env.step(action)
            
            # Store transition in replay buffer (handled by DQN's learn method)
            # Note: We'll need to manually handle this or use a different approach
            
            # For now, we'll train in batches during dedicated training sessions
            pass
    
    def train(self, total_timesteps: int = 10000, save_path: Optional[str] = None):
        """
        Train the DQN agent for a specified number of timesteps.
        Uses Stable Baselines 3's learn() method which handles the training loop internally.
        
        Args:
            total_timesteps: Number of timesteps to train
            save_path: Path to save the trained model
        """
        if self.model is None or self.env is None:
            raise ValueError("Model not initialized. Create environment first.")
        
        save_path = save_path or self.model_path
        
        # Use DQN's built-in learn() method which handles the training loop
        # This properly manages the replay buffer and training updates
        self.model.learn(
            total_timesteps=total_timesteps,
            callback=self.training_callback,
            log_interval=100,
            progress_bar=True
        )
        
        # Save the model
        os.makedirs(os.path.dirname(save_path) if os.path.dirname(save_path) else ".", exist_ok=True)
        self.model.save(save_path)
        print(f"Model saved to {save_path}")
        
        # Print training statistics
        if self.training_callback.episode_rewards:
            avg_reward = np.mean(self.training_callback.episode_rewards[-100:])
            print(f"Average episode reward (last 100): {avg_reward:.2f}")
        if self.training_callback.avg_delivery_times:
            avg_delivery = np.mean(self.training_callback.avg_delivery_times[-100:])
            print(f"Average delivery time (last 100): {avg_delivery:.2f}")
    
    def save(self, path: str):
        """Save the model to a file."""
        if self.model is not None:
            os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
            self.model.save(path)
            print(f"Model saved to {path}")
    
    def load(self, path: str, graph: Graph):
        """Load a model from a file."""
        if os.path.exists(f"{path}.zip"):
            self.graph = graph
            self.env = DeliveryEnv(graph)
            self.model = DQN.load(path, env=self.env)
            print(f"Model loaded from {path}")
        else:
            raise FileNotFoundError(f"Model file not found: {path}.zip")

