# Robustness testing

The benchmark in the README (38.30 s to 21.81 s, a 43% drop) comes from one scenario: 100 vehicles on a
fixed schedule, SUMO's default random seed, and a clean camera with 5% count noise. This page records how the
trained model holds up when those conditions change.

## What "weather" and "camera" mean here

SUMO has no weather model, so conditions in `flowstate/conditions.py` are simulated stand-ins:

- **Weather** changes driving: lower top speed, slower acceleration and braking, more erratic drivers and longer reaction times.
- **Camera quality** changes what the agent sees: shorter detection range, noisier counts and missed vehicles.
- **Demand** scales traffic volume ("rush hour" is 30% more cars).

None of this is real rain footage or real camera hardware.

## Results (original model, mean of 3 seeds, lower wait is better)

| Condition | Fixed timing | PPO | Change |
|---|---|---|---|
| clear | 42.20 | 29.11 | +31.0% |
| light rain | 53.45 | 38.55 | +27.9% |
| heavy rain | 51.07 | 48.02 | +6.0% |
| fog | 45.46 | 32.83 | +27.8% |
| night, low-res camera | 42.20 | 32.57 | +22.8% |
| storm + poor camera | 77.03 | 40.02 | +48.1% |
| rush hour | 78.32 | 55.55 | +29.1% |

Reproduce with `python -m flowstate.evaluate_robust`.

## What this shows

- The model beats fixed timing in every condition tested, but the gains vary widely (6% to 48%) and are not the same as the headline 43%.
- Averaged over three seeds the clear-weather gain is about 31%. The 43% figure is specific to SUMO's default seed.
- Heavy rain is the weak spot.

## An attempt to make it robust

I trained a second PPO model for 200,000 steps with randomized conditions every episode
(`python -m flowstate.train_robust`). It did not help overall. It improved on light rain, fog, storm and rush hour
against fixed timing, but it was worse than the original model in clear weather (9% worse than fixed timing),
in heavy rain and with the low-resolution camera. Because it is not a better model, it is not included in this
repository. The training and comparison code is kept so the experiment can be repeated, for example with more training
steps, a smaller randomization range or a larger network.

"Any weather and any camera with identical results" is not something this approach delivers. Real deployment would need
real camera data and validation with traffic engineers.
