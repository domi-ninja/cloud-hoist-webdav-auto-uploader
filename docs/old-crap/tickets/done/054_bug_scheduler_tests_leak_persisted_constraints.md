# 054 Bug: scheduler tests leak persisted constraints

Status: done

## Found while

Running ticket 009's scheduler instrumentation tests after adding durable global settings.

## Symptom

The default queue-drain test intermittently sees `CONNECTED` instead of `UNMETERED`, depending on which test ran first.

## Cause

Work was cleared between tests, but the new SharedPreferences-backed transfer constraints were not. The constraint-replacement test correctly persisted its opt-in setting into the following test.

## Fix

- Restore default transfer constraints in scheduler test setup.
- Continue recreating the preference object in the process-persistence test.

## Acceptance criteria

- Every scheduler test starts with unmetered and battery-not-low defaults.
- The persistence test still proves values survive object recreation.
- Test order no longer changes queue-drain constraints.

## Open question

**Question:** Should production preferences gain a general reset method for tests?

**Default:** No. Explicitly set the few public defaults in setup instead of adding a production-only reset escape hatch.
