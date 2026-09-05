# 091 Replace the existing-file cutoff with collision behavior

Status: done

Parent: 037

Depends on: 005, 090

## Outcome

Every source discovers eligible files that already exist on the phone. The source setting controls what happens when the destination filename already exists on Nextcloud, not whether older local files enter the upload ledger.

## Work

- Remove the New files only and Include existing files choice from source creation.
- Stop using source creation time as a discovery cutoff. The first scan must consider every eligible local file the app can read.
- Add a per-source destination-collision setting to the source editor.
- Default to replacing the destination file with the local file, including when the local file has an older modification time.
- Offer Keep both as the non-default choice. It uploads a renamed copy instead of replacing the destination.
- Define one deterministic filename scheme for Keep both and apply it before direct or chunked upload begins.
- Preserve ticket 005's staged upload and atomic replacement behavior. A failed replacement must not damage the existing server file.
- Persist enough identity and upload state to avoid uploading an unchanged local file on every scan.
- Apply the selected behavior consistently after Reset upload history and when the app rediscovers a local file under a repaired permission grant.
- Migrate existing sources to the replace behavior. Do not preserve the old discovery cutoff under a hidden compatibility flag.

## Acceptance criteria

- New and migrated sources consider eligible files regardless of when the source was created.
- The source editor has Replace on Nextcloud as the default and Keep both as the alternative.
- Replace safely overwrites a same-name destination even when Nextcloud reports a newer modification time.
- Keep both leaves the existing destination untouched and uploads the local bytes under a deterministic new name.
- An unchanged local file does not upload again on every scan.
- Reset upload history causes matching local files to be reconsidered under the source's current collision setting.
- Direct and chunked uploads produce the same final naming behavior.

## Verification

- Add native tests for first-scan discovery without a creation cutoff.
- Add integration coverage for a missing destination, same-name destination, older local modification time, Keep both naming, repeated scans, and history reset.
- Run TypeScript, Expo lint, Jest, and native Android tests.
- Against a disposable Nextcloud folder, verify the byte content and final names for Replace and Keep both.

## Not in this ticket

- Conflict resolution based on file contents
- Downloading or merging server changes
- Version-history controls in Nextcloud
- User-defined rename templates

## $grilling

❓ **Q1** - **Should Replace ignore timestamps completely?**: Ticket 037 explicitly says to clobber the server file when the local version is older. Should the app also replace it when the timestamps are equal or unavailable?

➡️ Yes. For Replace, a same-name collision is the only condition that matters. Local timestamps are unreliable across Android providers and WebDAV servers.

❓ **Q2** - **How should Keep both name copies?**: A timestamp is readable but can collide. A numeric suffix is deterministic but requires probing the destination.

➡️ Use `name (1).ext`, then increment until the name is free. It matches common file-manager behavior and does not pretend timestamps are unique.
