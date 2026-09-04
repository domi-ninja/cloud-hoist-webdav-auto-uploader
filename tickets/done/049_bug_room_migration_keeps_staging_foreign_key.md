# 049 Room migration keeps the staging foreign key name

Status: complete

Found while working on: 006

## Bug

Schema migration 1 to 2 created child tables referencing
`upload_jobs_new`, then renamed that parent to `upload_jobs`. On the emulator's
SQLite build, the child foreign-key metadata kept the staging table name.

## Impact

Room rejects the migrated database during schema validation.

## Fix

Copy child rows into temporary backup tables, replace and rename the job table,
then recreate child tables against the final parent name and restore their rows.

## Acceptance criteria

- Room validates schema 2 after migrating a populated schema 1 database.
- Upload attempts and chunk checkpoints retain their rows.
- Both child foreign keys point to `upload_jobs` after migration.

## Open question

**Question:** Should migrations depend on SQLite rename updating foreign keys?

**Default:** No. Recreate dependent tables against their final parent name so
behavior does not vary by Android SQLite version.
