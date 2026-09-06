# 020 Pin a complete Java toolchain for Android builds

Status: completed

## Resolution

Setup installs a checksum-pinned Temurin JDK 21 when needed. The environment script now resolves one `JAVA_HOME` containing both `java` and `javac`, and Gradle compiles successfully.

Found while working on: 001

## Bug

The first Gradle build auto-selected `/usr/lib/jvm/java-21-openjdk-amd64`, but that installation contains only the Java runtime. It has no `javac`, so Gradle cannot create Android compilation tasks.

## Impact

`pnpm android` fails before compiling the app, and the documented setup is not reproducible on machines where `java` exists but a full JDK does not.

## Fix

- Install a supported full JDK.
- Resolve and export `JAVA_HOME` in the Android environment script.
- Fail early with a useful message if either `java` or `javac` is missing.
- Document the pinned Java requirement and include it in setup verification.

## Acceptance criteria

- `java` and `javac` resolve from the same `JAVA_HOME`.
- `pnpm android` gets past Gradle toolchain discovery.
- A missing compiler produces a short setup error before Gradle starts.

## Open question

**Question:** Should the repository manage a JDK download itself?

**Default:** Use the operating system's OpenJDK package and validate it in the script; do not add a second language-version manager solely for Java.
