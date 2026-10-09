"""Simulated operating conditions: sensor (camera) quality and weather-like driving behaviour.

SUMO has no weather model, so "weather" here means what weather changes for traffic: slower, more
cautious and more erratic driving. "Camera" quality means what the sensor reports: how far it sees,
how noisy its counts are and how many vehicles it misses. These are simulated stand-ins, not real
rain footage or real camera hardware.
"""
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class Condition:
    # camera
    detection_dist: float = 50.0   # metres from the stop bar the camera can see
    noise_std: float = 0.05        # relative Gaussian noise on each count
    miss_rate: float = 0.0         # chance a vehicle in range goes undetected
    # driving / weather
    speed_factor: float = 1.0      # multiplier on max speed
    accel_factor: float = 1.0      # multiplier on acceleration
    decel_factor: float = 1.0      # multiplier on braking
    sigma: float = 0.5             # driver imperfection (0 perfect, 1 erratic)
    tau: float = 1.0               # driver reaction time (s)
    # demand
    scale: float = 1.0             # traffic volume multiplier


# The unmodified setup the original model was trained and benchmarked on.
DEFAULT = Condition()

NAMED = {
    "clear": DEFAULT,
    "light rain": Condition(speed_factor=0.9, accel_factor=0.9, decel_factor=0.85, sigma=0.6, tau=1.15, noise_std=0.10, miss_rate=0.05),
    "heavy rain": Condition(speed_factor=0.75, accel_factor=0.75, decel_factor=0.7, sigma=0.7, tau=1.3, noise_std=0.15, miss_rate=0.12, detection_dist=40),
    "fog": Condition(speed_factor=0.65, accel_factor=0.8, decel_factor=0.8, sigma=0.65, tau=1.4, noise_std=0.2, miss_rate=0.2, detection_dist=30),
    "night, low-res camera": Condition(noise_std=0.25, miss_rate=0.15, detection_dist=35),
    "storm + poor camera": Condition(speed_factor=0.65, accel_factor=0.7, decel_factor=0.65, sigma=0.8, tau=1.5, noise_std=0.3, miss_rate=0.25, detection_dist=30),
    "rush hour": Condition(scale=1.3),
}


def sample(rng):
    """Draw a random condition from the ranges the robust model is trained on."""
    return Condition(
        detection_dist=rng.uniform(25, 80),
        noise_std=rng.uniform(0.0, 0.3),
        miss_rate=rng.uniform(0.0, 0.3),
        speed_factor=rng.uniform(0.6, 1.0),
        accel_factor=rng.uniform(0.6, 1.0),
        decel_factor=rng.uniform(0.6, 1.0),
        sigma=rng.uniform(0.5, 0.9),
        tau=rng.uniform(1.0, 1.6),
        scale=rng.uniform(0.8, 1.3),
    )


__all__ = ["Condition", "DEFAULT", "NAMED", "sample", "replace"]
