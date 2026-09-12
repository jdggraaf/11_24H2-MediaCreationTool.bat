# Repository review: findings and suggested improvements

## Summary

This review covers `MediaCreationTool.bat` (~1645 lines, hybrid batch/PowerShell) and the `bypass11/` helper scripts, verified directly against the source. The most significant issues cluster around the download/execution path: the `DOWNLOAD` function tries plaintext HTTP before HTTPS on every fetch, no downloaded artifact (MCT exe, products CAB/XML) is ever hash- or signature-checked before being expanded or executed, and the newer 25H2 dynamic CAB-fetch function (`FETCH_25H2_CAB`) builds its FE3 metadata-service query from hardcoded 24H2-era build/edition literals instead of the live registry values it reads but never uses. None of these are exploited today in a way that's visibly broken, but each weakens the trust chain for a script that self-elevates via UAC and then runs what it downloads. The remaining findings are lower-severity robustness gaps (a missing `ProductVersion` registry value in the unattend file, a leftover `.Admin` shell association) and a long tail of documentation drift (stale version numbers, a stale changelog, an external pastebin link where a repo file already exists) that don't affect functionality but make the project harder to trust and maintain.

## Fixes

| Severity | File:Line | Problem | Fix |
|---|---|---|---|
| High | `MediaCreationTool.bat:1062` | `DOWNLOAD` builds `$http`/`$https` from the same URL and does `foreach ($url in $http, $https)` — plaintext HTTP is tried first via BitsTransfer/Invoke-WebRequest/bitsadmin/WebClient before HTTPS, even though every catalog URL (lines 152-273) is already `https://`. On a hostile network this lets a MITM substitute the downloaded EXE, which is then run unverified (`start MediaCreationTool%VID%.exe /Selfhost`, line 414) after the script has already self-elevated via UAC (lines 327, 706). | Swap the loop to `foreach ($url in $https, $http)`, or drop the `http` fallback entirely — it has no legitimate use here. |
| High | `MediaCreationTool.bat:946` | In `FETCH_25H2_CAB` (lines 939-1055, the path used for choice-19 / `VER=26200`/`VID=11_25H2`), `$build`/`$ubr`/`$editionId` are read from the registry (lines 946-948) but never referenced again. The FE3 device-info query instead hardcodes `$targetVersion = "26100.0.0.0"`, `OSVersion=10.0.26100.1`, and `CompositionEditionId=Enterprise`/`EditionId=Professional`. Most concerning: `MediaVersion`/`LcuVersion` are hardcoded to `10.0.28000.1340`, an unrelated Canary-era build, not tied to 26200 (25H2) or the real registry values. | Derive `MediaVersion`/`LcuVersion` from `$env:CB` or the registry-read `$build`/`$ubr` instead of the unrelated `10.0.28000.1340` literal, and wire `$editionId`/`$env:EDITION` into `CompositionEditionId`/`EditionId`. Leave the `OSVersion` "known-good baseline" convention alone unless tested against the live FE3 endpoint — it may be intentionally fixed per upstream precedent. |
| Medium | `MediaCreationTool.bat:397` (and 402, 414) | `products*.cab` is expanded and `MediaCreationTool*.exe` is launched immediately after download with only a file-existence check (`if not exist %%s set err=1`, line 402) — no `Get-FileHash`/checksum/`Get-AuthenticodeSignature` anywhere in the file. A corrupted/partial download or a compromised CDN edge would go undetected. | Add a `Get-AuthenticodeSignature` check (Status `-eq Valid`, Microsoft signer) on `MediaCreationTool%VID%.exe` before it's executed at line 414. |
| Low | `bypass11/windows_update_refresh.bat:6-7` (also `Skip_TPM_Check_on_Dynamic_Update.cmd:45-46`) | Both scripts register `HKCU\Software\Classes\.Admin\shell\runas\command` to self-elevate but never remove it, leaving a standing "run any `*.Admin` file elevated" association in the user's hive after the script exits. Still gated by a normal UAC prompt, so it's a hygiene/persistence issue, not silent privesc. | Once running elevated, clean up with `reg delete hkcu\software\classes\.Admin /f >nul 2>nul` in both scripts. |
| Low | `bypass11/AutoUnattend.xml:31` (mirrored in `MediaCreationTool.bat:855-860`) | The "hide unsupported-hardware update nag" policy writes `TargetReleaseVersion` (line 31-32) and `TargetReleaseVersionInfo` (line 35) but never `ProductVersion`, which Microsoft's own docs describe as required alongside `TargetReleaseVersion` for this policy to be unambiguous. | Add a 4th `RunSynchronousCommand` (Order 4): `reg add HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate /v ProductVersion /d "Windows 11" /t reg_sz /f`. |

## Expansions

- **No integrity verification for any downloaded MCT exe/CAB/XML** (`MediaCreationTool.bat:1058`, `DOWNLOAD` function) — add official SHA256 hashes per choice-N block (e.g. `EXESHA`/`CABSHA`) and verify with `Get-FileHash` right after download, before `expand.exe` or `start` run on the file; on mismatch, delete + retry once, then fall into the existing `err=1` pause path instead of proceeding.
- **No log file / transcript for diagnosing failed runs** (`MediaCreationTool.bat`, `FETCH_25H2_CAB` catch block ~1051-1053) — diagnostics are console-only `write-host` calls that vanish when the window closes. Add an opt-in append-only log (`"%WORK%\MCT\mct.log"`) from `FETCH_25H2_CAB`'s catch block and `DOWNLOAD`'s failure paths, and also add the CAB output to the existing err-check loop (~line 407, which today only checks `products.xml`/`MediaCreationTool%VID%.exe`) so a CAB-fetch failure actually triggers the pause instead of silently continuing.
- **Version table requires a manual code change per feature update** (`MediaCreationTool.bat:55`, `:choice-19` block, `FETCH_25H2_CAB:960/975`) — `VERSIONS`/`dV` and the CB/CT/CC/EXE fields are necessarily hand-curated per release (no discoverable API), but `FETCH_25H2_CAB`'s internals (`$targetVersion`, `CompositionEditionId`) could be generalized into a `FETCH_CAB` routine parameterized by `%VER%`/`%EDITION%` env vars, reusable for the next feature update instead of a copy-pasted function.
- **No external config-file support** (`MediaCreationTool.bat:14-31`) — persistent defaults (`MCT`, `AUTO`, `EDITION`, `LANGCODE`, `ARCH`, `KEY`, `NO_UPDATE`, `DEF`) only live as commented `rem set` lines in the script or in the filename, both of which are lost on re-download. Add an optional sibling `.ini` loader after line 31, mirroring the existing `product.ini` parsing pattern at line 731, e.g.:
  ```bat
  if exist "%~dpn0.ini" for /f "usebackq tokens=1,2 delims==" %%O in ("%~dpn0.ini") do set "%%O=%%P"
  ```

## Docs and hygiene

- `bypass11/readme.md:4-5` cites stale `v7`/`V9` version labels for `Skip_TPM_Check_on_Dynamic_Update.cmd`, which now self-identifies as `V13` (2023.12.07) — drop hardcoded version numbers from the prose or bump them.
- `README.md`'s Changelog block (lines 96-150) stops at `2022.03.20` while `MediaCreationTool.bat:6-13` has a `2026.01.15` entry covering TPM Bypass Enhancements and 25H2 CAB fetch, both already advertised at `README.md:6-12` — append a matching changelog entry.
- `bypass11/readme.md:58` links `windows_update_refresh.bat` to an external pastebin (`https://pastebin.com/XQsgjt9p`) even though the file already ships in `bypass11/` — change to a relative link, consistent with the other in-repo script links in the same file.
- `bypass11/readme.md:30-34` documents `Quick_11_iso_esd_wim_TPM_toggle.bat` only for the drag-and-drop SendTo use case; it doesn't mention that running it bare installs/uninstalls its own SendTo shortcut (script lines 7-18), or that a second CLI argument (`1`/`0`) forces patch/undo instead of auto-toggling (lines 20-21) — add both notes.
- `.gitattributes` is a single blanket `* -text` rule instead of scoping CRLF-preservation intent to the files that need it (`*.bat`, `*.cmd`, `*.xml`, …) — rescope for documentation value, but keep `-text` semantics (avoid `text eol=crlf`, which would trigger a renormalization diff across the repo).
- No `CONTRIBUTING.md` despite a dense 1645-line hybrid batch/PowerShell/XML file with no CI — optional short doc covering CRLF requirement, comment conventions, and the `:choice-N` ↔ `VERSIONS` mapping.
- Two independently-maintained changelogs exist (`MediaCreationTool.bat:7` header block vs. `README.md:89-149`), and the README one has already gone stale (last entry 2022 vs. script's 2026) — consolidate into a single `CHANGELOG.md` and have both other locations point to it.

## Suggested order of work

1. Swap `DOWNLOAD`'s HTTPS/HTTP order (`MediaCreationTool.bat:1062`) — one-line fix, closes the most easily-exploited gap.
2. Add `ProductVersion` to the unattend TPM/update-nag policy block (`bypass11/AutoUnattend.xml:31`, mirrored in `MediaCreationTool.bat:855-860`) — small, low-risk addition.
3. Add the `.Admin` registry cleanup to `windows_update_refresh.bat` and `Skip_TPM_Check_on_Dynamic_Update.cmd` — small, self-contained.
4. Fix the pastebin link and the stale version references in `bypass11/readme.md`, and append the missing changelog entry in `README.md` — pure docs, no code risk.
5. Add `Get-AuthenticodeSignature` verification before executing the downloaded `MediaCreationTool*.exe` (`MediaCreationTool.bat:414`).
6. Fix `FETCH_25H2_CAB`'s hardcoded `MediaVersion`/`LcuVersion`/edition literals to use the registry values already read at lines 946-948 — needs testing against the live FE3 endpoint before/after.
7. Add hashing for CAB/XML downloads and a narrow diagnostic log for `DOWNLOAD`/`FETCH_25H2_CAB` failures, and close the err-check gap so a CAB-fetch failure actually pauses instead of continuing silently.
8. Longer-term hygiene: consolidate the two changelogs, add a `CONTRIBUTING.md`, rescope `.gitattributes`, and generalize `FETCH_25H2_CAB`/add an external `.ini` config loader.

## Checked and dismissed

- AutoUnattend.xml's `TargetReleaseVersionInfo=25H1` — deliberate, documented (`25H1 is not a typo ;)`), a known nag-suppression technique, not a bug.
- `set (REG_EDITION=)` malformed clear — real syntax defect but inert; `REG_EDITION` is always undefined before use regardless.
- Product-key last-char validation (`PKEY1`/`PKEY28`) — functions as an implicit length gate matching the documented 29-char format; not a no-op.
- `.gitignore` excluding `.github/` — trivially overridden with `git add -f`; not a real CI blocker, and no CI exists today.
- `:canary` 2nd-TPM-check patch being ISO-only — intentionally scoped per the script's own comment and changelog, not a bug.
