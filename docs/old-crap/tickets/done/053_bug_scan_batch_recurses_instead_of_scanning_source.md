# 053 Bug: scan batch recurses instead of scanning source

Status: done

## Found while

Running the focused native tests for ticket 009's Room-backed scan workers.

## Symptom

Normal scan-runner tests overflow the stack, while the bounded-run test exhausts its fake clock without scanning a source.

## Cause

`EngineScanRunner` used `scan` for both its injected per-source callback and its private batch method. The call inside the batch resolved to the method itself because a source ID also satisfies its nullable string parameter.

## Fix

- Rename the injected callback to `scanSource`.
- Keep the batch method private and invoke the callback explicitly for each source ID.
- Rerun normal, empty-drain, and bounded-yield tests.

## Acceptance criteria

- Each source ID reaches the injected source scanner once.
- A two-source batch terminates without recursion.
- The time budget can stop between sources and request the accumulated queue drain.

## Open question

**Question:** Should the batch method and callback remain overloadable?

**Default:** No. Distinct names make the orchestration boundary obvious and prevent Kotlin overload resolution from hiding this mistake.
