import gymnasium as gym

class GraphWrapper(gym.Env):

    def __init__(self, graph, num_of_drivers):
        super.__init__()
        self.graph = graph
        
        self.observation_space = gym.spaces.MultiDiscrete([1000000]*(num_of_drivers + 2))
        self.action_space = gym.spaces.Discrete(graph.num_drivers + 1) # value graph.num_drivers represent no driver
    

    def get_observation(t, k):
        pass