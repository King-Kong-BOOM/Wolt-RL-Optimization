
class Optimizer:
    """
    class which just abstacts optimizer. Should have methods for training, evaluating, saving, loading, etc.
    Reinforcment learning specific functionality should be implemented in subclasses or separate modules since
    we might need to create reference implementations for other optimization methods as well.
    We want to optimize the allocation of drivers to orders over time. We are not concerned with routing or pathfinding
    in this optimizer because the drivers are assumed to act optimally in that regard.

    The main goal of the optimizer is to divide drivers to orders such that orders are delivered quickly and each driver gets
    equitable amount of work. The main problem we are solving here is the spring paradox where drivers greedily hoard orders 
    to have as much work as possible. However, this leads to suboptimal outcomes for customers as each driver has to drive further distances
    to pick up new orders. Versus if we allocate fairly the new orders to the drivers, each driver has less work but the overall system is more efficient
    because the drivers dont have to hoard orders to have work to do. In this case the reward function should be something like
    a weighted sum of negative delivery time and negative lse of the mean square distance of drivers' workloads from the average workload.

    And/or we might want to try to just minimize the average delivery time of orders and to just model this kind of systems as a control problem.
    In this case the reward function is just negative average/sum delivery time of orders. 

    keep in mind that using average rather than sum is more robust in rl environments where the number of orders can vary a lot.
    Also since this is continuous setting we are maximizing the average reward per time step rather than total reward over an episode.
    """
    def __init__(self):
        pass

    