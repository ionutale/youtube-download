# Pause vs Suspend — two distinct halting mechanisms

Downloads can be halted for two reasons: the user explicitly pauses them (via the UI), or the scheduler halts them outside its allowed time window. These have different semantics — user-paused downloads require explicit user resume, while scheduler-halted downloads must auto-resume when the window reopens. Treating both as `paused` conflates the two intents and would force the user to manually resume everything after every schedule window. We introduce a separate `suspended` status for scheduler-initiated halts.

**Alternatives considered:** (1) Track the halt source with a boolean flag `pausedBySchedule`, but that adds per-record branching logic and doesn't surface the state clearly in API responses. (2) Keep using only `queued` for schedule halts and `paused` for user halts, but a `queued` item that was running before is confusing to users. (3) The `suspended` status makes the state visible in the UI, the API, and the event stream without per-record flags.

**Consequences:** The UI needs a badge for `suspended`. The `checkSchedule` method must distinguish between user-paused (leave as `paused`) and scheduler-paused (set to `suspended`). When the window opens, `checkSchedule` must find all `suspended` records and re-queue them.
