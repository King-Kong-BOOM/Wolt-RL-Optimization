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
        
        # Update app state with new graph
        if app_state is None:
            from appstate import AppState
            app_state = AppState(graph=new_graph)
        else:
            app_state.graph = new_graph
        
        # Update global app state reference
        set_app_state(app_state)
        from websocket_handler import set_app_state as set_ws_app_state, start_simulation_loop
        set_ws_app_state(app_state)
        
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
    
    try:
        data = request.get_json()
        if not data or 'timesteps' not in data:
            return jsonify({
                "success": False,
                "message": "Missing timesteps in request"
            }), 400
        
        timesteps = data['timesteps']
        
        if app_state is None or app_state.graph is None:
            return jsonify({
                "success": False,
                "message": "No simulation available. Create a simulation first."
            }), 404
        
        # Set training mode to reduce communication
        from websocket_handler import set_training_mode, send_training_start_message, send_training_end_message
        set_training_mode(True)
        
        # Send training start message
        start_timestep = app_state.graph.timestep
        send_training_start_message(start_timestep)
        
        # TODO: Implement actual training logic
        # For now, simulate training by running timesteps without sending updates
        # In the future, this should:
        # 1. Run training for specified timesteps
        # 2. Update optimizer during training
        # 3. Skip or reduce state updates during training (already implemented)
        
        # Simulate training (run timesteps without frequent updates)
        # This is a placeholder - actual training will be implemented later
        for _ in range(timesteps):
            if app_state and app_state.graph:
                app_state.time_step()
        
        # End training mode and send final state
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
        
        from websocket_handler import set_simulation_speed
        set_simulation_speed(speed)
        
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
