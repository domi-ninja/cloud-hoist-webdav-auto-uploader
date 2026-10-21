# Files shown as Nextcloud only

The 2026-1 investigation found an inventory overlap. A backup targeting
`/Cloud Hoist/DCIM` recursively listed `/Cloud Hoist/DCIM/Screenshots`.
A separate Screenshots backup owned those files locally. The parent had no matching
local entries, so the same screenshot appeared twice, including once as Nextcloud only.

The inventory now excludes destination subfolders owned by another configured
backup from the parent's listing. This applies when the child backup is disabled
and when filtering to a single folder. It does not delete or move server files.

A file can still correctly appear as Nextcloud only after its phone copy was
deleted, when it was placed on the server by another client, or when Android no
longer grants access to the local copy. Cloud Hoist keeps uploaded files after
phone deletion. These entries remain visible with a cloud icon. They are not
counted as newly uploaded phone files.

The overlap fix has a focused native test covering nested destinations and a
similarly named sibling that must remain visible.
