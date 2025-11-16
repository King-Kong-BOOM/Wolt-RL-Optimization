from flask import Blueprint, request, jsonify
import json

"""
This module defines the routes Blueprint for the Flask application.

This module basically defines the user interface endpoints for interacting with the backend.

This module should include features for:

- Retrieving the current state of the graph, drivers, and orders when the simulation is running.
  This should probably be implemented using websockets for real-time updates.

- Sending commands to start, stop, and reset the simulation. Can be probably be implemented using simple HTTP POST (or GET)
  requests as these are not real-time commands.

- Configuring the simulation setting such as number of drivers, order distribution, optimizer settings, etc. Altough these are
  probably only modifed before starting the simulation so they can also be implemented using simple HTTP requests.

- Functionality for saving and loading simulation states. This can be useful for debugging and testing different optimizer strategies
  Also when showing the simulation to others we dont have to train from scratch each time.

- Also perhaps some route for retrieving statistics for the performance of the optimizer over time such as average delivery time.

"""

routes = Blueprint("routes", __name__)

# Global app state instance (will be set by main.py)
app_state = None

def set_app_state(state):
    """Set the global app state instance."""
    global app_state
    app_state = state

@routes.route('/api/simulation/render-data', methods=['GET'])
def get_render_data():
    """
    HTTP GET endpoint for fetching initial render data when simulation is not running.
    Returns the current graph state for rendering.
    
    Note: This endpoint does NOT expose distance_matrix or path_matrix to minimize network traffic.
    Path computation for driver routes will be done server-side via a separate endpoint.
    """
    global app_state
    
    if app_state is None or app_state.graph is None:
        return jsonify({
            "success": False,
            "message": "No simulation graph available"
        }), 404
    
    try:
        render_data = app_state.graph.get_render_data()
        return jsonify({
            "success": True,
            "data": render_data
        })
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error getting render data: {str(e)}")
        print(error_trace)
        return jsonify({
            "success": False,
            "message": f"Error getting render data: {str(e)}"
        }), 500

@routes.route('/api/simulation/create', methods=['POST'])
def create_simulation():
    """
    HTTP POST endpoint for creating a new simulation/graph.
    Accepts hyperparameters and creates a new Graph instance.
    """
    global app_state
    
    try:
        data = request.get_json()
        if not data or 'hyperparameters' not in data:
            return jsonify({
                "success": False,
                "message": "Missing hyperparameters in request"
            }), 400
        
        hyperparameters = data['hyperparameters']
        
        # Extract graph parameters from hyperparameters
        num_nodes = hyperparameters.get('num_nodes', 6)
        num_drivers = hyperparameters.get('num_drivers', 2)
        num_edges = hyperparameters.get('num_edges', 7)
        
        # Validate that num_edges >= num_nodes - 1 (minimum for connected graph)
        min_edges = num_nodes - 1
        if num_edges < min_edges:
            return jsonify({
                "success": False,
                "message": f"Number of edges ({num_edges}) must be at least {min_edges} (num_nodes - 1) for a connected graph."
            }), 400
        
        # Create new graph
        from graph import Graph
        new_graph = Graph(
            num_nodes=num_nodes,
            num_edges=num_edges,
            num_drivers=num_drivers
        )
        
        # Check if user wants to initialize optimizer
        initialize_optimizer = hyperparameters.get('initialize_optimizer', False)
        # Handle string "true"/"false" from JSON (though it should be boolean)
        if isinstance(initialize_optimizer, str):
            initialize_optimizer = initialize_optimizer.lower() in ('true', '1', 'yes')
        elif not isinstance(initialize_optimizer, bool):
            initialize_optimizer = bool(initialize_optimizer)
        
        print(f"DEBUG: initialize_optimizer flag from request: {initialize_optimizer} (type: {type(initialize_optimizer)})")
        print(f"DEBUG: Full hyperparameters dict: {hyperparameters}")
        optimizer = None
        
        if initialize_optimizer:
            print("DEBUG: Attempting to initialize DQN optimizer...")
            try:
                from dqn_optimizer import DQNOptimizer
                optimizer = DQNOptimizer(graph=new_graph)
                print("DQN Optimizer initialized successfully")
            except ImportError as e:
                import traceback
                error_trace = traceback.format_exc()
                print(f"ERROR: Could not import DQN optimizer: {e}")
                print(error_trace)
                # Don't fail silently - return error to user
                return jsonify({
                    "success": False,
                    "message": f"Failed to initialize optimizer: {str(e)}. Make sure stable-baselines3 is installed: pip install stable-baselines3"
                }), 500
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                print(f"ERROR: Could not initialize optimizer: {e}")
                print(error_trace)
                # Don't fail silently - return error to user
                return jsonify({
                    "success": False,
                    "message": f"Failed to initialize optimizer: {str(e)}"
                }), 500
        
        # Update app state with new graph
        if app_state is None:
            from appstate import AppState
            app_state = AppState(graph=new_graph, optimizer=optimizer)
            print(f"DEBUG: Created new AppState with optimizer: {optimizer is not None}")
        else:
            app_state.graph = new_graph
            # Always update optimizer (set to None if not initializing, or to new optimizer if initializing)
            app_state.optimizer = optimizer
            if optimizer is not None:
                print(f"DEBUG: Updated existing AppState with optimizer: {optimizer is not None}")
            else:
                print(f"DEBUG: Set optimizer to None (not initializing)")
        
        print(f"DEBUG: Final app_state.optimizer: {app_state.optimizer is not None if app_state else 'app_state is None'}")
        
        # Update global app state reference
        set_app_state(app_state)
        from websocket_handler import set_app_state as set_ws_app_state, start_simulation_loop
        set_ws_app_state(app_state)
        print(f"DEBUG: App state synchronized to websocket_handler")
        if app_state.optimizer is not None:
            print(f"DEBUG: Optimizer type after sync: {type(app_state.optimizer)}")
        
        # Start the simulation loop
        start_simulation_loop()
        
        return jsonify({
            "success": True,
            "message": "Simulation created successfully"
        })
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error creating simulation: {str(e)}")
        print(error_trace)
        return jsonify({
            "success": False,
            "message": f"Error creating simulation: {str(e)}"
        }), 500

@routes.route('/api/simulation/train', methods=['POST'])
def train_agent():
    """
    HTTP POST endpoint for training the RL agent.
    During training, communication is reduced/disabled to save resources.
    """
    global app_state
    print(f"Training endpoint called. app_state: {app_state is not None}, graph: {app_state.graph is not None if app_state else False}, optimizer: {app_state.optimizer is not None if app_state else False}")
    
    try:
        data = request.get_json()
        print(f"Training request data: {data}")
        if not data:
            return jsonify({
                "success": False,
                "message": "Missing request body"
            }), 400
        
        if 'timesteps' not in data:
            return jsonify({
                "success": False,
                "message": "Missing 'timesteps' in request body"
            }), 400
        
        timesteps = int(data['timesteps'])
        print(f"Training requested for {timesteps} timesteps")
        
        if app_state is None:
            return jsonify({
                "success": False,
                "message": "No simulation available. Create a simulation first."
            }), 404
        
        if app_state.graph is None:
            return jsonify({
                "success": False,
                "message": "No graph available. Create a simulation first."
            }), 404
        
        if app_state.optimizer is None:
            print("ERROR: Training requested but optimizer is None!")
            print(f"DEBUG: app_state exists: {app_state is not None}")
            print(f"DEBUG: app_state.graph exists: {app_state.graph is not None if app_state else False}")
            print(f"DEBUG: app_state.optimizer: {app_state.optimizer}")
            print(f"DEBUG: app_state.optimizer type: {type(app_state.optimizer)}")
            print("Hint: Initialize optimizer by:")
            print("  1. Checking 'Initialize DQN Optimizer' when creating simulation, OR")
            print("  2. Calling POST /api/simulation/initialize-optimizer endpoint")
            return jsonify({
                "success": False,
                "message": "No optimizer available. Please initialize optimizer first. Check 'Initialize DQN Optimizer' when creating simulation or call /api/simulation/initialize-optimizer endpoint."
            }), 400  # Changed from 404 to 400 (Bad Request) since endpoint exists but precondition not met
        
        # Set training mode to reduce communication
        from websocket_handler import set_training_mode, send_training_start_message, send_training_end_message
        set_training_mode(True)
        
        # Send training start message
        start_timestep = app_state.graph.timestep
        send_training_start_message(start_timestep)
        
        # Train the agent
        try:
            # Check if optimizer has train method
            if hasattr(app_state.optimizer, 'train'):
                app_state.train = True  # Enable training mode
                app_state.optimizer.train(total_timesteps=timesteps)
            else:
                # Fallback: run timesteps with training enabled
                app_state.train = True
                for _ in range(timesteps):
                    if app_state and app_state.graph:
                        app_state.time_step()
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"Error during training: {str(e)}")
            print(error_trace)
            app_state.train = False
            set_training_mode(False)
            return jsonify({
                "success": False,
                "message": f"Training error: {str(e)}"
            }), 500
        
        # End training mode and send final state
        app_state.train = False
        end_timestep = app_state.graph.timestep
        set_training_mode(False)
        send_training_end_message(end_timestep)
        
        return jsonify({
            "success": True,
            "message": f"Training completed for {timesteps} timesteps"
        })
    except Exception as e:
        # Ensure training mode is turned off on error
        from websocket_handler import set_training_mode
        set_training_mode(False)
        return jsonify({
            "success": False,
            "message": f"Error during training: {str(e)}"
        }), 500

@routes.route('/api/simulation/pause', methods=['POST'])
def pause_simulation():
    """
    HTTP POST endpoint for pausing the simulation.
    """
    global app_state
    
    try:
        if app_state is None or app_state.graph is None:
            return jsonify({
                "success": False,
                "message": "No simulation available"
            }), 404
        
        from websocket_handler import stop_simulation_loop
        stop_simulation_loop()
        
        return jsonify({
            "success": True,
            "message": "Simulation paused"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error pausing simulation: {str(e)}"
        }), 500

@routes.route('/api/simulation/resume', methods=['POST'])
def resume_simulation():
    """
    HTTP POST endpoint for resuming the simulation.
    """
    global app_state
    
    try:
        if app_state is None or app_state.graph is None:
            return jsonify({
                "success": False,
                "message": "No simulation available"
            }), 404
        
        from websocket_handler import start_simulation_loop
        start_simulation_loop()
        
        return jsonify({
            "success": True,
            "message": "Simulation resumed"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error resuming simulation: {str(e)}"
        }), 500

@routes.route('/api/simulation/speed', methods=['POST'])
def set_speed():
    """
    HTTP POST endpoint for setting the simulation speed (timesteps per second).
    """
    try:
        data = request.get_json()
        if not data or 'speed' not in data:
            return jsonify({
                "success": False,
                "message": "Missing speed in request"
            }), 400
        
        speed = float(data['speed'])
        if speed <= 0:
            return jsonify({
                "success": False,
                "message": "Speed must be greater than 0"
            }), 400
        
        from websocket_handler import set_simulation_speed, start_simulation_loop
        set_simulation_speed(speed)
        
        # Start the simulation loop if it's not already running
        # This ensures time starts advancing when speed is set
        start_simulation_loop()
        
        return jsonify({
            "success": True,
            "message": f"Simulation speed set to {speed} timesteps per second",
            "speed": speed
        })
    except ValueError:
        return jsonify({
            "success": False,
            "message": "Invalid speed value. Must be a number."
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error setting speed: {str(e)}"
        }), 500

@routes.route('/api/simulation/speed', methods=['GET'])
def get_speed():
    """
    HTTP GET endpoint for getting the current simulation speed.
    """
    try:
        from websocket_handler import get_simulation_speed
        speed = get_simulation_speed()
        
        return jsonify({
            "success": True,
            "speed": speed
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error getting speed: {str(e)}"
        }), 500

@routes.route('/api/simulation/assign-order', methods=['POST'])
def assign_order():
    """
    HTTP POST endpoint for manually assigning an order to a driver.
    Accepts order_id and driver_id in request body.
    """
    global app_state
    
    if app_state is None or app_state.graph is None:
        return jsonify({
            "success": False,
            "message": "No simulation available"
        }), 404
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "message": "Missing request body"
            }), 400
        
        order_id_str = data.get('order_id')
        driver_id_str = data.get('driver_id')
        
        if not order_id_str or not driver_id_str:
            return jsonify({
                "success": False,
                "message": "Missing order_id or driver_id in request"
            }), 400
        
        # Parse IDs (format: "order-{id}" and "driver-{id}")
        try:
            order_id = int(order_id_str.replace('order-', ''))
            driver_id = int(driver_id_str.replace('driver-', ''))
        except (ValueError, AttributeError):
            return jsonify({
                "success": False,
                "message": "Invalid order_id or driver_id format"
            }), 400
        
        graph = app_state.graph
        
        # Find the order
        order = None
        for o in graph.orders:
            if o.order_id == order_id:
                order = o
                break
        
        if order is None:
            return jsonify({
                "success": False,
                "message": f"Order with id {order_id} not found"
            }), 404
        
        # Check if order is already delivered
        if order.is_delivered:
            return jsonify({
                "success": False,
                "message": "Cannot assign a delivered order"
            }), 400
        
        # Find the driver
        driver = None
        for d in graph.drivers:
            if d.driver_id == driver_id:
                driver = d
                break
        
        if driver is None:
            return jsonify({
                "success": False,
                "message": f"Driver with id {driver_id} not found"
            }), 404
        
        # Create an action and pass it through app_state.apply_action() to use the same path as optimizer
        action = {
            'type': 'assign',
            'order_id': order_id,
            'driver_id': driver_id
        }
        
        # Apply the action through AppState (same path as optimizer actions)
        app_state.apply_action(action)
        
        # Verify the assignment was successful
        if driver.order is None or driver.order.order_id != order_id:
            return jsonify({
                "success": False,
                "message": "Assignment failed - order or driver not found"
            }), 400
        
        return jsonify({
            "success": True,
            "message": f"Order {order_id} assigned to driver {driver_id}"
        })
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error assigning order: {str(e)}")
        print(error_trace)
        return jsonify({
            "success": False,
            "message": f"Error assigning order: {str(e)}"
        }), 500

@routes.route('/api/simulation/optimizer-status', methods=['GET'])
def optimizer_status():
    """
    HTTP GET endpoint for checking optimizer status.
    """
    global app_state
    
    if app_state is None:
        return jsonify({
            "success": False,
            "has_optimizer": False,
            "message": "No simulation available"
        }), 404
    
    if app_state.graph is None:
        return jsonify({
            "success": False,
            "has_optimizer": False,
            "message": "No graph available"
        }), 404
    
    has_optimizer = app_state.optimizer is not None
    optimizer_type = type(app_state.optimizer).__name__ if has_optimizer else None
    
    return jsonify({
        "success": True,
        "has_optimizer": has_optimizer,
        "optimizer_type": optimizer_type,
        "message": f"Optimizer status: {'Initialized' if has_optimizer else 'Not initialized'}"
    })

@routes.route('/api/simulation/initialize-optimizer', methods=['POST'])
def initialize_optimizer():
    """
    HTTP POST endpoint for initializing the DQN optimizer.
    """
    global app_state
    
    if app_state is None or app_state.graph is None:
        return jsonify({
            "success": False,
            "message": "No simulation available. Create a simulation first."
        }), 404
    
    try:
        from dqn_optimizer import DQNOptimizer
        optimizer = DQNOptimizer(graph=app_state.graph)
        app_state.optimizer = optimizer
        
        return jsonify({
            "success": True,
            "message": "DQN Optimizer initialized successfully"
        })
    except ImportError:
        return jsonify({
            "success": False,
            "message": "Stable Baselines 3 not installed. Install with: pip install stable-baselines3"
        }), 500
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error initializing optimizer: {str(e)}")
        print(error_trace)
        return jsonify({
            "success": False,
            "message": f"Error initializing optimizer: {str(e)}"
        }), 500

# TODO: Future endpoint for computing driver paths on-demand (e.g., for mouse hover)
# @routes.route('/api/simulation/driver-path', methods=['GET'])
# def get_driver_path():
#     """
#     HTTP GET endpoint for computing driver path from current location to target node.
#     This will be called server-side when frontend needs to render driver path on hover.
#     
#     Query parameters:
#         driver_id: ID of the driver
#         target_node: Target node ID
#     
#     Returns:
#         JSON with path as list of node IDs
#     
#     Note: This keeps path computation server-side and avoids sending distance_matrix/path_matrix
#     through the network.
#     """
#     pass
