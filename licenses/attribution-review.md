# Attribution catalogue

This records the packages raised in the F-Droid review and the code embedded in the Android libraries. Full license texts, copyright notices, source URLs, and evidence hashes are checked in beside this file and included in the app's offline notices.

The previous report treated a missing standalone `LICENSE` file as an unresolved review item even when the package supplied its license elsewhere. Each case below now has a recorded disposition. App version `2026-8` contains the corrected notices; the published `2026-7` APK remains unchanged.

## The sixteen npm packages

| Package originally flagged | Resolution |
| --- | --- |
| `@expo/devcert@1.2.1` | Replaced with `1.2.2`, which includes the full MIT license and Dave Wasmer/Expo copyright notices. |
| `@expo/sdk-runtime-versions@1.0.0` | Replaced with `1.0.1`, which includes Expo's full MIT license. |
| `@expo/ws-tunnel@2.0.0` | Replaced with `2.0.1`, which includes Expo's full MIT license. This is development-server tooling, not an Android app library. |
| `bplist-parser@0.3.1` | Retained. Its published README supplies the full MIT license, including Near Infinity Corporation's copyright. That complete section is preserved. |
| `bplist-parser@0.3.2` | Retained with the same version-specific README evidence. |
| `client-only@0.0.1` | Retained. The exact published package explicitly grants MIT and supplies only an empty module and a module-boundary error. Preserve its declaration and complete standard MIT terms. No copyright statement is supplied; none has been invented. |
| `dlv@1.1.3` | Retained. The published README explicitly selects MIT and the package identifies Jason Miller. Preserve those statements and the complete MIT terms. The README's old `oss.ninja` link now redirects to an unrelated site and is not used as license evidence. |
| `imurmurhash@0.1.4` | Retained. Its published README supplies the full MIT license and Gary Court/Jens Taylor copyright notice. |
| `jimp-compact@0.16.1` | Replaced with the original `jimp@0.16.1` through an npm alias. Its bundled dependencies become separate, inventoried packages. This preserves the Jimp API used by Expo's image tooling and removes reliance on the compact bundle's incomplete notice inventory. |
| `react-remove-scroll-bar@2.3.8` | Retained. The package declares MIT; the complete project license and Anton Korzunov copyright notice are preserved from upstream license commit `7301c160fda44cb8cf2b9fdfde61efad35736196`. This is a DOM/web dependency. |
| `server-only@0.0.1` | Retained. Like `client-only`, its exact package grants MIT and contains an empty module and a module-boundary error. Preserve that declaration and the full MIT terms without inventing a copyright statement. |
| `standard-navigation@0.0.5` | Replaced with `0.0.9`, which includes the full MIT license and React Navigation Contributors copyright notice. |
| `structured-headers@0.4.1` | Retained. The package declares MIT. Preserve Evert Pot's complete project license from upstream license commit `1762e198465b2ebe4ddf07633ab67d42f85189ea`. |
| `bser@2.1.1` | Replaced with `2.1.2`, which includes the complete Apache 2.0 license. |
| `fb-watchman@2.0.2` | Replaced with `2.0.4`, which includes the complete Apache 2.0 license. |
| `fb-dotslash@0.5.8` | Retained under its MIT option. The complete upstream MIT grant and Meta copyright notice were already available; the unused fallback declaration is removed. Downloaded DotSlash executables remain excluded from prepared F-Droid source. |

The exact retained evidence is in [npm-upstream.json](npm-upstream.json). Published package files are authoritative for the replacement versions. These are mostly build tools or web dependencies; the offline inventory deliberately includes more than the JavaScript shipped in Android.

The Jimp replacement exposed five further packages without root license files. `@tokenizer/token@0.3.0` and `readable-web-to-node-stream@3.0.4` supply complete MIT licenses in their READMEs. `omggif@1.0.10` supplies its full MIT grant in its source header. `parse-bmfont-ascii@1.0.6` has a version-pinned upstream MIT license. `buffer-equal@0.0.1` explicitly selects MIT in its published README; its declaration and the full standard terms are retained. These are also recorded in `npm-upstream.json`.

`@expo/xcpretty@4.4.4` had already been replaced with `4.4.6`. Its published license retains the inherited Marin Usalj credit and Expo's copyright. The override remains pinned.

## Embedded native code

[embedded.json](embedded.json) records each component's version, parent dependency, source URL, complete notices, and notice hashes. Parent version changes and changes to React Native's native dependency versions require another review. Some notice bundles deliberately include unused components from the same source release so a narrow build selection cannot omit a required credit.

| Component | Version | License evidence |
| --- | --- | --- |
| [Boost](https://raw.githubusercontent.com/boostorg/boost/boost-1.83.0/LICENSE_1_0.txt) | `1.83.0` | `boost-license.archive` |
| [double-conversion](https://github.com/google/double-conversion/tree/v1.1.6) | `1.1.6` | `LICENSE` |
| [fast_float](https://github.com/fastfloat/fast_float/tree/v8.0.0) | `8.0.0` | `LICENSE-MIT` |
| [fmt](https://github.com/fmtlib/fmt/tree/12.1.0) | `12.1.0` | `LICENSE` |
| [glog](https://github.com/google/glog/tree/v0.3.5) | `0.3.5` | `COPYING` |
| [Folly](https://github.com/facebook/folly/tree/v2024.11.18.00) | `2024.11.18.00` | `LICENSE`, `folly/hash/detail/ChecksumDetail.cpp`, `folly/hash/SpookyHashV2.h (public-domain credit)` |
| [Hermes](https://github.com/facebook/hermes/tree/hermes-v250829098.0.17) | `250829098.0.17` | `LICENSE` |
| [Hermes LLVM](https://github.com/facebook/hermes/tree/hermes-v250829098.0.17) | `250829098.0.17` | 14 complete license files/source headers; see embedded.json |
| [Hermes regex](https://github.com/facebook/hermes/tree/hermes-v250829098.0.17) | `250829098.0.17` | `include/hermes/Regex/LICENSE.TXT` |
| [Hermes Boost](https://github.com/facebook/hermes/tree/hermes-v250829098.0.17) | `250829098.0.17` | `external/boost/boost_1_86_0/LICENSE_1_0.txt` |
| [Hermes ZIP/miniz](https://github.com/facebook/hermes/tree/hermes-v250829098.0.17) | `250829098.0.17` | `external/zip/UNLICENSE` |
| [Hermes AsmJit](https://github.com/facebook/hermes/tree/hermes-v250829098.0.17) | `250829098.0.17` | `external/asmjit/asmjit/LICENSE.md` |
| [Hermes dtoa](https://github.com/facebook/hermes/tree/hermes-v250829098.0.17/external/dtoa) | `250829098.0.17` | `external/dtoa/dtoa.c`, `external/dtoa/g_fmt.c` |
| [Hermes ICU declarations](https://github.com/facebook/hermes/blob/hermes-v250829098.0.17/external/icu_decls/license.html) | `250829098.0.17` | `external/icu_decls/license.html (plain text)` |
| [Android NDK runtime](https://dl.google.com/android/repository/android-ndk-r27b-linux.zip) | `27.1.12297006` | `toolchains/llvm/prebuilt/linux-x86_64/NOTICE`, `toolchains/llvm/prebuilt/linux-x86_64/sysroot/NOTICE` |
| [Fresco](https://github.com/facebook/fresco/tree/v3.6.0) | `3.6.0` | `LICENSE` |
| [libjpeg-turbo](https://github.com/libjpeg-turbo/libjpeg-turbo/tree/2.1.5.1) | `2.1.5.1` | `LICENSE.md`, `README.ijg`, `IJG binary-distribution acknowledgement` |
| [libpng](https://github.com/glennrp/libpng/tree/v1.6.37) | `1.6.37` | `LICENSE` |
| [libwebp](https://github.com/webmproject/libwebp/tree/v1.3.2) | `1.3.2` | `COPYING`, `PATENTS`, `AUTHORS` |
| [giflib](https://deb.debian.org/debian/pool/main/g/giflib/giflib_5.2.1.orig.tar.gz) | `5.2.1` | `giflib-5.2.1/COPYING` |
| [zstd-kmp](https://github.com/square/zstd-kmp/tree/4fbdf35df030888d2a0cce4a84329d107438134f) | `0.4.0` | `LICENSE`, `zstd-kmp/native/include/LICENSE` |
| [Zstandard](https://github.com/facebook/zstd/tree/1dbc2e09084e843f6c0dcc2d0791610015c50979) | `1.5.8` | `LICENSE` |
| [AndroidX Graphics Path](https://android.googlesource.com/platform/frameworks/support/+/8a05a22af450d589ef911d772a001a49dcb05b71/graphics/graphics-path/src/main/cpp/) | `1.0.1` | `Path.h`, `PathIterator.cpp`, `Conic.cpp`, `Apache-2.0` |
| [OkHttp Public Suffix List](https://raw.githubusercontent.com/square/okhttp/parent-4.12.0/okhttp/src/main/resources/okhttp3/internal/publicsuffix/publicsuffixes.gz) | `4.12.0` | `Mozilla Public License 2.0`, `NOTICE and source offer` |
| [Pika API](https://raw.githubusercontent.com/lukmccall/pika/198378fdc1e52c5611cc70a78250dc485ee2cb00/LICENSE.txt) | `0.3.2` | `LICENSE.txt` |
| [Infer annotations](https://repo.maven.apache.org/maven2/com/facebook/infer/annotation/infer-annotation/0.18.0/infer-annotation-0.18.0-sources.jar) | `0.18.0` | `com/facebook/infer/annotation/NoAllocation.java (license header)`, `MIT permission and disclaimer` |
| [Brotli Java](https://repo.maven.apache.org/maven2/org/brotli/dec/0.1.2/dec-0.1.2-sources.jar) | `0.1.2` | `org/brotli/dec/BitReader.java (license header)`, `org/brotli/dec/IntReader.java (license header)`, `MIT permission and disclaimer` |
| [Yoga proguard annotations](https://raw.githubusercontent.com/facebook/yoga/v1.19.0/LICENSE) | `1.19.0` | `LICENSE` |

Fresco's notice applies to all 24 listed Fresco Maven modules. Its codec versions come from the `v3.6.0` build configuration. The JPEG notice includes the required statement: "This software is based in part on the work of the Independent JPEG Group."

Hermes's root MIT license does not replace the LLVM, regex, dtoa, ICU, Boost, ZIP/miniz, and AsmJit notices. The retained imported-code notices include their own permission terms and copyright holders. The ICU HTML notice is preserved as plain text for offline reading. LLVM and Folly source files with separate full permission blocks are included too.

The NDK runtime entry retains the toolchain and sysroot notice bundles from NDK `27.1.12297006`. Stripping the SDK's `libc++_shared.so` reproduces the APK's runtime bytes for all four ABIs. The APK gate checks those hashes, so changing the runtime cannot silently reuse the old notice review.

Zstandard uses its BSD license option. Its submodule commit is pinned by zstd-kmp's `0.4.0` source release. zstd-kmp's copied JNI headers also carry GPL 2 with the Classpath exception; those complete terms are retained separately from its Apache license.

OkHttp's Public Suffix List has its own MPL 2.0 license. Its source download matches the bytes inside OkHttp `4.12.0`. The complete MPL terms and source offer are included offline, and [the readable rule list](public-suffix-list-4.12.0.txt) is retained here. It round-trips to the rules and exceptions in the distributed compressed data.

The two bundled fonts retain their Apache 2.0 notices in [MaterialDesignIcons.txt](MaterialDesignIcons.txt) and [MaterialSymbols.txt](MaterialSymbols.txt). The inventory resolves actual Gradle artifacts, including variant-named AARs, and reads notices inside their nested JARs. It records 149 artifacts and 39 metadata/platform components across all 188 resolved Maven coordinates. POM declarations, artifact notices, and parent-POM supplements remain recorded in [native.json](native.json) and [declarations.json](declarations.json).

## Every native library in the APK

| Library | Accounted components |
| --- | --- |
| `libandroidx.graphics.path.so` | AndroidX Graphics Path@1.0.1 |
| `libappmodules.so` | Cloud Hoist |
| `libc++_shared.so` | Android NDK runtime@27.1.12297006 |
| `libexpo-modules-core.so` | expo-modules-core@57.0.16 |
| `libfbjni.so` | com.facebook.fbjni:fbjni:0.7.0 |
| `libgesturehandler.so` | react-native-gesture-handler@2.32.0 |
| `libgifimage.so` | Fresco@3.6.0, giflib@5.2.1, libjpeg-turbo@2.1.5.1, libpng@1.6.37, libwebp@1.3.2 |
| `libhermestooling.so` | Hermes AsmJit@250829098.0.17, Hermes Boost@250829098.0.17, Hermes ICU declarations@250829098.0.17, Hermes LLVM@250829098.0.17, Hermes ZIP/miniz@250829098.0.17, Hermes dtoa@250829098.0.17, Hermes regex@250829098.0.17, Hermes@250829098.0.17 |
| `libhermesvm.so` | Hermes AsmJit@250829098.0.17, Hermes Boost@250829098.0.17, Hermes ICU declarations@250829098.0.17, Hermes LLVM@250829098.0.17, Hermes ZIP/miniz@250829098.0.17, Hermes dtoa@250829098.0.17, Hermes regex@250829098.0.17, Hermes@250829098.0.17 |
| `libimagepipeline.so` | Fresco@3.6.0, giflib@5.2.1, libjpeg-turbo@2.1.5.1, libpng@1.6.37, libwebp@1.3.2 |
| `libjsi.so` | react-native@0.86.3 |
| `libnative-filters.so` | Fresco@3.6.0, giflib@5.2.1, libjpeg-turbo@2.1.5.1, libpng@1.6.37, libwebp@1.3.2 |
| `libnative-imagetranscoder.so` | Fresco@3.6.0, giflib@5.2.1, libjpeg-turbo@2.1.5.1, libpng@1.6.37, libwebp@1.3.2 |
| `libreact_codegen_rnscreens.so` | react-native-screens@4.26.2 |
| `libreact_codegen_safeareacontext.so` | react-native-safe-area-context@5.7.0 |
| `libreactnative.so` | Boost@1.83.0, Folly@2024.11.18.00, double-conversion@1.1.6, fast_float@8.0.0, fmt@12.1.0, glog@0.3.5, react-native@0.86.3 |
| `libreanimated.so` | react-native-reanimated@4.5.0 |
| `librnscreens.so` | react-native-screens@4.26.2 |
| `libstatic-webp.so` | Fresco@3.6.0, giflib@5.2.1, libjpeg-turbo@2.1.5.1, libpng@1.6.37, libwebp@1.3.2 |
| `libworklets.so` | react-native-worklets@0.10.0 |
| `libzstd-kmp.so` | Zstandard@1.5.8, zstd-kmp@0.4.0 |

The 21 library names must match each APK ABI. A new library, a missing library, an unreviewed parent version, an altered notice, or a changed C++ runtime fails the release check. Java/Kotlin classes remain covered by the Maven inventory; npm modules remain covered by the package inventory.

## Checks

Run `pnpm licenses:generate` after reviewing a dependency change, then `pnpm licenses:check`. The generator rejects packages without a complete notice entry; npm metadata-only fallback records are no longer accepted automatically. Focused release tests exercise missing notices, changed dependency versions, unknown owners, and unaccounted APK libraries, and notices inside nested AAR JARs.

`pnpm fdroid:build` checks the actual unsigned APK with `node scripts/fdroid/licenses.mjs --check --apk <path>`. Ordinary CI uses the same gate. No key or network connection is needed to regenerate or check the bundled notices after dependencies are installed.

Candidate `2026-8` passes 97 JavaScript tests, 104 native tests, five Node release tests and one Python artifact-notice test, metadata lint, icon/notice checks, the privacy check, and a clean F-Droid source/build/APK scan. PNG and JPEG output from the Jimp replacement matches the original decoded pixels. Thirteen checks passed after a signed in-place update on Samsung SM-A166B / Android 16, including large-notice scrolling, required credits, search, closing/reopening, navigation, and preserved account/settings/upload state. F-Droid developer-signature reconstruction passes. The independently built [CI APK](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/actions/runs/40119400305) is byte-identical. The [public verification APK](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/tag/fdroid-reference-2026-8) matches the phone-tested signed file and passes F-Droid reconstruction against that CI build.

The F-Droid build-server and maintainer review remain external gates; no licensing question in this catalogue requires contacting a maintainer on Domi's behalf.
