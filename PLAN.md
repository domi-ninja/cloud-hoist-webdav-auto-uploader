# WebDAV Auto Upload product plan

This file records the decisions for the app. We will work through them in grilling rounds. Each answer changes which questions become available next, so the later rounds are provisional.

Planning status: complete. All six rounds were accepted.

## Settled starting point

- Name the product **WebDAV Auto Upload**, with slug and future public repository `webdav-auto-upload` and Android package `ninja.domi.webdavautoupload`. Keep the existing local directory name.
- Build an open-source, Android-first app that handles Nextcloud automatic uploads.
- Use React Native, Expo development builds, TypeScript, NativeWind, and the supporting tools recorded in `TECH_STACK.md`.
- Keep the app local-first. It connects directly to the user's server and has no application backend.
- Treat reliable Android background work as more important than staying inside Expo's JavaScript APIs.

## Decision tree

```text
Product identity
|-- Intended user
|   |-- Onboarding depth
|   |-- Diagnostics and support burden
|   `-- Account count
|-- Product boundary
|   |-- Source types and folder selection
|   |-- Upload semantics
|   `-- UI and settings
|-- Server scope
|   |-- Authentication
|   |-- Upload protocol
|   `-- Compatibility policy
|-- Reliability promise
|   |-- Android scheduling
|   |-- Retry and recovery
|   |-- Battery and network constraints
|   `-- User-visible status
|-- Distribution [research in progress]
|   |-- Storage permissions
|   |-- Play Store and F-Droid variants
|   `-- Minimum Android version
`-- Relationship to Nextcloud source [research in progress]
    |-- Clean implementation or reused code
    |-- License
    `-- Upstream relationship
```

## Round 1: product roots

Status: accepted on 2026-09-04

❓ **Q1** - **Who is this for?**: Are we building a personal tool that happens to be open source, an enthusiast app for self-hosters, or a polished app for ordinary Nextcloud users?

➡️ I recommend an enthusiast app for self-hosters, built without assumptions tied to your own server. That keeps onboarding honest without turning v1 into a support desk for every broken reverse proxy.

❓ **Q2** - **What is the whole product?**: Is this strictly a one-way automatic uploader, or should it grow into browsing, downloading, sharing, or two-way synchronization?

➡️ I recommend one-way automatic upload only. Users can keep the official Nextcloud app for everything else. A narrow app has a real chance of making background upload boring and dependable.

❓ **Q3** - **What local content belongs in its promise?**: Should the app handle only photos and videos, any media Android knows about, or arbitrary files from user-selected folders?

➡️ I recommend arbitrary files from explicitly selected folders, with Camera and Screenshots offered as quick presets. We may ship media-only first if Android distribution rules make the general case substantially worse.

❓ **Q4** - **How broad is server support?**: Is the target Nextcloud only, Nextcloud plus ownCloud, or any WebDAV server?

➡️ I recommend Nextcloud only. We should isolate the WebDAV transport, but generic compatibility should earn its way in through tests and real users rather than becoming a vague promise.

❓ **Q5** - **What does reliable mean?**: Is best-effort periodic upload enough, or is the product promise that every eligible file eventually uploads unless the app shows a concrete blocker?

➡️ I recommend the stronger promise. Android may delay work, but the app must persist every job, survive restarts and reboots, retry transient failures, and tell the user when permissions, credentials, battery policy, or server errors stop progress.

Decisions:

- Build for self-hosting enthusiasts without assumptions tied to Domi's server.
- Keep the product to one-way automatic upload.
- Support arbitrary files from selected folders, with Camera and Screenshots as presets. A media-only first release remains acceptable if Android rules force that cut.
- Support Nextcloud only. Do not promise generic WebDAV compatibility.
- Persist every eligible upload and either complete it eventually or show the user what blocks it.

## Research findings

- Nextcloud's current auto-upload code is coupled to its native Android client. WorkManager, MediaStore observers, a database queue, foreground workers, boot recovery, and a large shared upload operation all participate. The core auto-upload files now use `AGPL-3.0-or-later`. We can study behavior, but copying that code commits this whole app to AGPL. [Nextcloud Android source](https://github.com/nextcloud/android/tree/master/app/src/main/java/com/nextcloud/client/jobs/autoUpload)
- Android's MediaStore can signal new photos and videos. Arbitrary folders use Android's Storage Access Framework and need periodic reconciliation because they do not provide the same dependable change signal. `MANAGE_EXTERNAL_STORAGE` creates a serious Play Store review risk and is unnecessary for explicitly selected folders. [Android shared storage](https://developer.android.com/training/data-storage/shared/documents-files) and [Google Play all-files policy](https://support.google.com/googleplay/android-developer/answer/10467955)
- WorkManager persists jobs across process death and reboot, but Android can delay them. Periodic work has a 15-minute minimum. Long transfers may need a foreground worker and visible notification. [Android persistent work](https://developer.android.com/develop/background-work/background-tasks/persistent) and [data-transfer guidance](https://developer.android.com/develop/background-work/background-tasks/data-transfer-options)
- Nextcloud provides Login Flow v2, WebDAV uploads, conditional requests, capability discovery, and resumable chunked-upload sessions. [Login Flow v2](https://docs.nextcloud.com/server/stable/developer_manual/client_apis/LoginFlow/index.html#login-flow-v2), [WebDAV](https://docs.nextcloud.com/server/stable/developer_manual/client_apis/WebDAV/basic.html), and [chunked uploads](https://docs.nextcloud.com/server/stable/developer_manual/client_apis/WebDAV/chunking.html)

## Round 2: release and implementation boundaries

Status: accepted on 2026-09-04

❓ **Q6** - **Where do we ship?**: Should we target GitHub APK releases, F-Droid, Google Play, or some combination? One build can use MediaStore for broad photo and video access plus the Storage Access Framework for explicitly selected arbitrary folders. That avoids the `MANAGE_EXTERNAL_STORAGE` permission and its Play review risk.

➡️ I recommend one policy-compliant build, released on GitHub and F-Droid first, with Google Play prepared from the start but published after the app proves itself.

❓ **Q7** - **Do we copy Nextcloud code?**: The current auto-upload core is AGPL-only and tangled with the full client. Do we accept AGPL and adapt it, or implement the behavior ourselves from public Android and Nextcloud APIs?

➡️ I recommend a clean implementation. Use upstream as a behavioral reference, but copy no source or tests. Expo owns screens and configuration. Kotlin owns discovery, the durable queue, WorkManager jobs, transfers, and recovery. The React Native app reads and controls that engine through one Expo module.

❓ **Q8** - **How many accounts in v1?**: Should one app installation connect to one Nextcloud account or several?

➡️ I recommend one account in v1. The queue records an account ID so multi-account support does not require replacing its schema, but we do not build account switching yet.

❓ **Q9** - **How should login work?**: Should we support only Nextcloud's browser-based Login Flow v2, only manually entered app credentials, or both?

➡️ I recommend Login Flow v2 as the normal path and manual server URL, username, and app password as a fallback. Store the returned app password in Android-backed SecureStore. Never accept the user's main password as the manual fallback.

❓ **Q10** - **How far back does Android support go?**: Older Android versions add testing and permission branches. What minimum version earns that cost?

➡️ I recommend Android 10, API 29. It is old enough for useful reach and new enough to avoid carrying much older storage behavior into a brand-new app.

Decisions:

- Maintain one build that avoids `MANAGE_EXTERNAL_STORAGE`. Prepare for Google Play, but release on GitHub and F-Droid first.
- Write a clean implementation. Do not copy Nextcloud source or tests.
- Put discovery, the Room queue, WorkManager jobs, transfers, and recovery in a Kotlin Expo module. Keep screens and configuration in React Native.
- Support one account in v1 while recording an account ID in durable records.
- Use Nextcloud Login Flow v2, with manually entered app credentials as a fallback. Never request or store the user's main password.
- Set the minimum supported version to Android 10, API 29.

## Round 3: data and safety contract

Status: accepted on 2026-09-04, with Q16 overridden

❓ **Q11** - **Which license do we use?**: A clean implementation lets us choose. Should forks have to remain open, or should companies and other apps be free to reuse the code under a permissive license?

➡️ I recommend `GPL-3.0-or-later`. This is a user-controlled alternative to a vendor client, and improvements to the distributed app should stay available to its users. AGPL adds little because we are not building a network service.

❓ **Q12** - **Which source types ship in v1?**: MediaStore can detect new photos and videos quickly. Android's folder picker can grant durable access to an arbitrary directory, but those folders need periodic scans and may update later.

➡️ I recommend both. Offer Camera and Screenshots as MediaStore presets, plus "Choose folder" through the Storage Access Framework. Tell users that arbitrary folders use periodic scanning rather than pretending every source is immediate.

❓ **Q13** - **What happens to files already in a folder?**: When a user enables a source, should we queue everything already there, start from that moment, or ask every time?

➡️ Ask during setup after showing the number and total size of existing eligible files. Default to "new files only" so enabling a folder cannot start a surprise 200 GB upload.

❓ **Q14** - **Can the app remove local files?**: Should successful uploads leave files untouched, optionally delete them, or optionally move them elsewhere?

➡️ Keep local files and offer no delete or move option in v1. An automatic background tool should earn trust before it gains destructive behavior.

❓ **Q15** - **How do local folders map to Nextcloud?**: Should a source upload flat into one remote folder, mirror its relative subfolders, or organize files by capture date?

➡️ Give every source one remote destination. Mirror relative subfolders for arbitrary folder trees. Keep media presets flat. Leave year and month organization for later because it changes paths based on fallible metadata.

❓ **Q16** - **What happens when a remote name exists?**: We can skip, overwrite, or create a renamed sibling such as `photo (2).jpg`.

➡️ Original recommendation: never overwrite in v1. Domi overrode this. The app overwrites the destination by default because conflict copies become a maintenance burden.

❓ **Q17** - **Do changed local files upload again?**: A photo editor or another app may modify a file after its first successful upload. Should that count as a new upload?

➡️ Yes. Treat a changed size or modification timestamp as a new revision and apply the same rename-on-conflict rule. Do not hash every file during ordinary scans.

❓ **Q18** - **Do we support Nextcloud end-to-end encrypted folders?**: Nextcloud E2EE uses more than ordinary WebDAV and would add a separate encryption and key-management project.

➡️ No E2EE folders in v1. Normal server-side encryption remains transparent and needs no special app support.

❓ **Q19** - **How do we handle self-signed TLS certificates?**: We can require Android to trust the server certificate, or build an explicit certificate review and pinning flow.

➡️ Use Android's trust store in v1. Never add a "trust all certificates" switch. Users with private certificate authorities can install their CA on the device; explicit certificate pinning can come later.

Decisions:

- License the app under `GPL-3.0-or-later`.
- Ship MediaStore presets for Camera and Screenshots plus arbitrary folders selected through the Storage Access Framework.
- During source setup, show the existing file count and size. Ask whether to include them, defaulting to new files only.
- Never delete or move local files in v1.
- Give each source one remote root. Mirror custom-folder subdirectories and keep media presets flat. Do not add date-based folders in v1.
- Overwrite an existing destination by default. Stage the upload under a temporary remote name, then replace the destination only after the complete payload reaches Nextcloud.
- Re-upload locally changed files. Detect changes with size and modification time rather than hashing every scan.
- Do not support Nextcloud end-to-end encrypted folders in v1.
- Trust only certificates accepted by Android's trust store. Do not offer an insecure TLS bypass.

## Round 4: scheduling, retries, and recovery

Status: accepted on 2026-09-04

❓ **Q20** - **What happens when a source file moves or gets renamed?**: Android may expose it under a new URI or relative path. We could spend time correlating it with its old identity, or treat it as a newly eligible file.

➡️ Treat it as a new file and upload it to its new remote path. Do not hash the device to guess that two paths contain the same bytes.

❓ **Q21** - **How often do we reconcile sources?**: MediaStore events can wake a one-shot scan quickly, but Android may delay them. Arbitrary folders have no equivalent dependable event and need periodic scans.

➡️ Trigger media scans from MediaStore changes and request a reconciliation every 15 minutes for all enabled sources. Android may run it later. State that honestly in the UI rather than promising instant upload.

❓ **Q22** - **Which transfer constraints do users control?**: We can expose network type, charging, battery level, and roaming rules globally or per source.

➡️ Use global settings in v1. Default to unmetered networks only, charging not required, and Android's battery-not-low constraint enabled. Let users opt into any connected network. Do not build per-folder overrides yet.

❓ **Q23** - **How aggressively do we upload?**: Parallel uploads finish batches faster but compete for memory, bandwidth, server locks, and Android job time.

➡️ Run one transfer at a time in oldest-first order. Use bounded worker runs and resume the queue in later runs. Speed can wait until measurements show one-at-a-time is a problem.

❓ **Q24** - **When should the app notify?**: Android requires a visible foreground-service notification for long-running work. We can also notify about ordinary success and failure.

➡️ Show the required progress notification only while foreground upload work runs. Do not notify for routine success. Notify when uploads remain blocked by credentials, permissions, or repeated server failures, and make the notification open the relevant fix.

❓ **Q25** - **What does retry mean?**: Transient failures can retry forever, stop after a limit, or wait for manual action. Permanent failures can clog the queue if we misclassify them.

➡️ Retry network errors, timeouts, server 5xx responses, rate limits, and quota uncertainty with capped exponential backoff. Pause and explain authentication, permission, certificate, definite quota, and invalid-path failures. Never silently discard a queued file.

❓ **Q26** - **What manual controls exist?**: A background app still needs an escape hatch when Android or a server behaves strangely.

➡️ Provide Pause all, Resume, Scan now, and Retry failed. A source can also be enabled or disabled. Do not add per-item queue surgery in v1.

❓ **Q27** - **How much upload history stays on device?**: A permanent log grows forever and contains filenames. No history makes failures hard to understand.

➡️ Keep successful and skipped entries for 30 days. Keep unresolved failures until fixed or the source is removed. Let users clear completed history, but not queued work by accident.

❓ **Q28** - **What if a watched folder becomes unavailable?**: SAF permission can disappear, an SD card can be removed, or the user can delete the directory.

➡️ Keep the source configuration, mark it blocked, and explain how to grant access again. Do not delete its queue or silently create a replacement source.

❓ **Q29** - **What if the user deletes an uploaded file from Nextcloud?**: A local reconciliation could check the server and restore it, or the upload ledger can treat the completed job as final.

➡️ Do not monitor remote deletions and do not restore them. This is an uploader, not a mirror. Upload the local file again only if its local revision changes or the user explicitly resets that source's history.

Decisions:

- Treat a moved or renamed local file as a new file. Do not hash files to correlate paths.
- Trigger media scans from MediaStore changes and request full reconciliation every 15 minutes.
- Use global transfer constraints. Default to unmetered networks and battery-not-low, without requiring charging. Users can allow any connected network.
- Upload one file at a time, oldest first, in bounded worker runs.
- Show a progress notification only when foreground work requires it. Notify for actionable persistent blockers, not routine success.
- Retry transient failures with capped exponential backoff. Pause and explain failures that require user action. Never silently discard queued work.
- Provide Pause all, Resume, Scan now, Retry failed, and per-source enable or disable controls.
- Retain completed history for 30 days and unresolved failures until fixed or the source is removed.
- Keep unavailable source configurations and explain how to restore access.
- Do not monitor or reverse remote deletions. A completed local revision stays completed.

## Round 5: interface and privacy

Status: accepted on 2026-09-04

❓ **Q30** - **How should onboarding work?**: We can ask for every permission and setting at launch, or request each thing when the user reaches the feature that needs it.

➡️ Use a short guided path: connect Nextcloud, add the first source, choose its remote destination, decide whether existing files count, then show the home screen. Ask for Android permissions in context. Do not front-load a wall of permission dialogs.

❓ **Q31** - **What is the app's navigation?**: The app needs sources, activity, settings, and little else.

➡️ Use three plain bottom tabs: Sources, Activity, and Settings. Put account health and the global pause control at the top of Sources. Avoid drawers, nested menus, and a separate dashboard.

❓ **Q32** - **How does a user add a source?**: One dense settings form is faster to build. A short sequence is easier to understand and gives permissions context.

➡️ Use a compact step flow: source type, local folder, remote folder, include-existing choice, review. Keep advanced scheduling out because v1 uses global constraints.

❓ **Q33** - **How much status belongs on Sources?**: A background app can look healthy while Android has not run it for hours.

➡️ Show one honest status line per source: uploading, waiting for network, paused, blocked, or last scanned at a specific time. Also show queued and failed counts. Do not invent an exact next-run time that Android does not guarantee.

❓ **Q34** - **How does the user choose a remote folder?**: They could type a WebDAV path or browse a small remote folder picker.

➡️ Build a minimal folder-only Nextcloud browser with folder creation. It exists only inside source setup, not as a general file browser. Do not make users type or URL-encode DAV paths.

❓ **Q35** - **What happens when a source is removed?**: Removing configuration can leave queued work and private filename history behind, or clear it.

➡️ Ask for confirmation when uploads remain queued or failed. Then delete that source, its queue, and its history. Never touch local files or already uploaded remote files.

❓ **Q36** - **What does sign out do?**: Credentials cannot remain while the UI pretends the account is gone.

➡️ Explain that sign-out removes credentials, sources, queue entries, and local history. Require confirmation, cancel scheduled work, then wipe those records. Leave local and remote files alone.

❓ **Q37** - **Do we collect diagnostics?**: Hosted crash reporting and analytics help maintenance but send data from a file-management app to another service.

➡️ Ship with no analytics, telemetry, advertising ID, or hosted crash reporter. Keep a bounded local diagnostic log. Let users export a redacted report that removes credentials, tokens, full local paths, and remote filenames.

❓ **Q38** - **How much visual customization ships?**: Themes and density controls would add settings unrelated to uploading.

➡️ Follow the Android light or dark setting, respect system font scaling, and stop there. Use the project's simple visual rules. No theme picker, decorative dashboard, or multiple density modes.

❓ **Q39** - **Do we localize v1?**: Translation plumbing is cheap early, but actual translations and layout testing are ongoing work.

➡️ Ship English only in v1, but keep user-facing strings in one typed catalog instead of scattering literals through components. Add languages when contributors can own them.

Decisions:

- Onboard in context: connect Nextcloud, add a source, choose its destination, choose whether existing files count, then enter the app.
- Use three tabs: Sources, Activity, and Settings.
- Add sources with a compact step flow instead of one dense settings form.
- Show each source's real state, last scan time, queued count, and failed count. Do not promise an exact next run.
- Use a minimal remote folder picker with folder creation during source setup.
- Removing a source clears its queue and history after confirmation when unfinished work exists. It never touches local or remote files.
- Signing out clears credentials, sources, queued work, history, and scheduled work after confirmation. It never touches local or remote files.
- Collect no telemetry or hosted crash reports. Keep bounded local diagnostics and export only a redacted report.
- Follow the system light or dark setting and font scaling. Add no appearance controls in v1.
- Ship English only in v1 while keeping user-facing strings in one typed catalog.

## Project identity

- **Display name:** WebDAV Auto Upload
- **Expo slug and future public repository:** `webdav-auto-upload`
- **Android package:** `ninja.domi.webdavautoupload`
- **Compatibility wording:** "WebDAV Auto Upload uploads files to Nextcloud servers. WebDAV Auto Upload is an independent project and is not affiliated with or endorsed by Nextcloud GmbH."
- **Local directory:** keep `domi-nextcloud-auto-upload` unchanged

The name and icon must not use the Nextcloud name or cloud logo as product branding. Factual compatibility wording is allowed for an independent non-commercial project. [Nextcloud trademark guidelines](https://nextcloud.com/trademarks/)

## Round 6: MVP and release line

Status: accepted on 2026-09-04

❓ **Q40** - **Does the name promise generic WebDAV?**: `WebDAV Auto Upload` sounds broader than the first release, which uses Nextcloud login, capabilities, chunking, and DAV paths.

➡️ State plainly that v1 supports Nextcloud servers. Keep the transport code isolated and add generic WebDAV only after testing it against named servers. Do not put an untested "works with any WebDAV server" claim in the README or stores.

❓ **Q41** - **What exactly is v0.1?**: Without a hard boundary, settings and compatibility work can expand forever.

➡️ v0.1 connects one Nextcloud account, manages multiple MediaStore or SAF sources, picks or creates remote folders, optionally includes existing files, persists a native queue, uploads in the background under global constraints, safely overwrites collisions, resumes interrupted large uploads, and exposes status, activity, manual controls, and actionable errors. Nothing else belongs in v0.1.

❓ **Q42** - **How do we claim server compatibility?**: Nextcloud exposes capabilities, and older installations vary. A version number alone does not prove the required APIs work.

➡️ Detect capabilities instead of rejecting versions up front. Before release, test the newest stable Nextcloud and the oldest release Nextcloud still supports. Use ordinary WebDAV uploads when chunking is unavailable. Publish only the versions we actually test.

❓ **Q43** - **Is a real Android device required?**: The emulator is good for bootstrapping and deterministic tests, but it does not reproduce OEM battery management, camera events, SD cards, or ordinary long-term use.

➡️ Require at least one physical Android 13 or newer device before calling v0.1 releasable. Use the emulator throughout development, but do not make background-reliability claims from emulator results alone.

❓ **Q44** - **In what order do we build?**: Starting with every screen would postpone the risky native and server work.

➡️ Build one vertical path at a time:

1. Bootstrap Expo, the Android emulator, and a typed Kotlin Expo module.
2. Add Login Flow v2, capability discovery, and the remote folder picker.
3. Upload one manually selected fixture through the native engine, including staged overwrite and chunk resume.
4. Add Room queue state, MediaStore and SAF discovery, and WorkManager scheduling.
5. Build Sources, Activity, Settings, onboarding, constraints, and diagnostics against the working engine.
6. Test failure recovery, finish release metadata, and publish a GitHub prerelease.

❓ **Q45** - **What proves the upload engine works?**: A happy-path upload says little about an automatic uploader.

➡️ The release test must cover app process death, device reboot, offline-to-online recovery, changed constraints, expired credentials, revoked folder access, interrupted chunk upload, remote name overwrite, local modification, remote deletion, source removal, and sign-out. Every queued file must end as completed or visibly blocked. Run the core suite automatically and the OS lifecycle cases on a real device.

❓ **Q46** - **When is it ready for other people?**: "It uploaded my photo once" is too weak, while waiting for perfection means never shipping.

➡️ Publish v0.1 as a GitHub prerelease after the acceptance tests pass and a seven-day physical-device soak shows no silent misses. Prepare F-Droid after that. Treat Google Play as a later distribution task, not a blocker for proving the app.

❓ **Q47** - **Which tempting features stay out?**: The plan has accumulated several explicit non-goals. This is the last chance to object before they become the scope line.

➡️ Exclude iOS, web, multiple accounts, generic WebDAV claims, Nextcloud E2EE, local delete or move, date-based remote folders, per-source network rules, appearance settings, telemetry, remote deletion monitoring, manual queue editing, and hosted services from v0.1.

Decisions:

- State that v0.1 supports Nextcloud servers. Do not claim generic WebDAV compatibility without interoperability tests.
- Limit v0.1 to one account, multiple MediaStore or SAF sources, remote folder selection, optional initial import, a native durable queue, background uploads, global constraints, safe overwrite, resumable large uploads, status, activity, manual controls, and actionable errors.
- Detect server capabilities. Test the newest stable Nextcloud and the oldest release it still supports before publishing a compatibility range.
- Require a physical Android 13 or newer device before calling v0.1 releasable.
- Build in vertical slices: bootstrap, account and remote access, one native upload, durable background processing, UI, then hardening and release.
- Test lifecycle and failure recovery, not only successful foreground uploads. Every queued file must become completed or visibly blocked.
- Publish a GitHub prerelease after the acceptance suite and a seven-day physical-device soak show no silent misses. Prepare F-Droid next and defer Google Play publication.
- Keep the recorded non-goals out of v0.1.

## Provisional later rounds

None. The design tree is empty.

## v0.1 acceptance statement

On a physical Android device, a user can connect one Nextcloud account, configure Camera and arbitrary-folder sources, close the app, and trust every eligible file to upload under the selected global constraints. Process death, reboot, lost connectivity, and interrupted transfers do not lose queue state. When Android permissions, credentials, certificates, storage, or the server prevent progress, the app names the blocker and offers the relevant recovery action.

The app never deletes local files, never restores intentional remote deletions, never overwrites a remote destination with a partial transfer, and never reports queued work as successful before Nextcloud accepts the completed file.
