# 014 Verify lifecycle and failure recovery

Status: blocked by 013

Depends on: 003 through 013

## Outcome

The complete app meets the accepted v0.1 reliability statement on automated tests, an Android emulator, and at least one physical Android 13 or newer device.

## Work

- Use the ignored local `test-creds.tct` file for emulator acceptance against the configured Nextcloud server.
- Add a host-side acceptance launcher that validates the credential file exists, loads it without printing values, and transfers it only to debug-only test code. The app and production APK must have no runtime path that reads this host file.
- Put every emulator acceptance run under a unique remote directory owned by that run. Never inspect, overwrite, move, or delete pre-existing server files outside that directory.
- Redact command output, Gradle output, Android logs, HTTP logs, test reports, and failure snapshots. A failed test must not echo credentials or authorization headers.
- Test against the newest stable Nextcloud and the oldest release Nextcloud still supports at release time.
- Record detected capabilities and exercise ordinary and chunked transfer paths where available.
- Automate domain, DAV fixture, Room transition, WorkManager, module contract, and React Native component tests at the lowest useful layer.
- Create a repeatable device test sheet for process death, force-stop, reboot, offline-to-online recovery, network constraint changes, low battery, expired credentials, revoked folder access, certificate failure, quota failure, interrupted chunks, overwrite, local modification, remote deletion, source removal, and sign-out.
- Confirm each queued file reaches completed or a visible blocker. Search Room and logs for stuck ambiguous states after each scenario.
- Test partial media permission on Android 14 or newer and SAF grant restoration after reboot.
- Test notification-denied behavior and long-running foreground work.
- Run a seven-day physical-device soak with Camera and one SAF source. Compare discovered local revisions against completed or visibly blocked ledger entries each day.
- Fix defects found by these checks in this ticket only when they are local and small. Create focused follow-up tickets for architectural defects rather than hiding them in test code.

## Acceptance criteria

- All focused automated suites pass from a clean checkout.
- The emulator acceptance suite connects with `test-creds.tct`, exercises authentication plus direct and chunked uploads, and cleans up only its unique remote run directory.
- Missing or malformed local credentials skip the live-server suite with a clear non-secret message; they do not fail unrelated local tests.
- The full device sheet records app, Android, device, and Nextcloud versions plus a result for every scenario.
- No scenario silently loses, duplicates, or falsely completes a queue revision.
- A remote destination keeps its old complete bytes until a replacement finalizes.
- Remote deletion does not trigger restoration unless the local revision changes or history is explicitly reset.
- The seven-day soak reports no unexplained local revision missing from both queue and history.
- Tested Nextcloud versions and unsupported features are ready to publish without guessing.

## Verification

- Archive redacted automated outputs and the completed device test sheet under project documentation.
- Run a secret scan across Git history, build outputs, APK contents, Android logs, and saved test reports after the emulator acceptance suite.
- Re-run the highest-risk interruption cases after the last engine fix.
- Review all tests for meaningful assertions and delete redundant generated smoke tests.

## Not in this ticket

- Supporting every OEM battery manager
- Generic WebDAV certification
- Google Play review
- Performance tuning without a measured failure

## Open question

**Question:** May emulator acceptance tests delete the unique remote directory they created after a run?

**Default:** Yes. Delete only the run-specific directory created by that test invocation. If cleanup fails, report its exact test-run ID without exposing credentials and leave every pre-existing remote path untouched.
