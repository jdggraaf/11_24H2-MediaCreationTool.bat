# Contributing

## Line endings

`MediaCreationTool.bat` and the `bypass11/` scripts are hybrid `.bat`/`.cmd`/PowerShell
files parsed by `cmd.exe`; a stray LF inside them can corrupt parsing. All `.bat`,
`.cmd` and `.xml` files in this repo **must use CRLF line endings**, including any
new line you add or change. `.gitattributes` marks these files `-text` so git never
normalizes or diff-converts them - it does not add CRLF for you, so edit with a tool
that lets you control line endings exactly (e.g. Python opened in binary mode), not
a plain `sed -i` on the checked-out file.

## Style

Keep edits minimal and match the surrounding file's existing style: AveYo's terse
batch style for `.bat`/`.cmd` code, 2-space indented PowerShell blocks. Don't
reformat untouched lines.

## Running the tests

`tests/static-check.sh` is the repo's static test script. It checks CRLF line
endings, well-formed XML, that batch `goto`/`call` labels resolve, and that
PowerShell blocks have balanced braces. Run it after any change:

```
bash tests/static-check.sh
```

It must print `ALL CHECKS PASSED` before you're done.

If PowerShell 7 (`pwsh`) is installed or you point `PWSH=/path/to/pwsh` at one, the
script also parses every `#:NAME:#` PowerShell snippet exactly as the batch bootstrap
extracts it, so syntax errors in the embedded PowerShell are caught on Linux/macOS too.
Behaviour (WinForms dialogs, MCT, setup) can only be tested on Windows.

## `:choice-N` / `VERSIONS` mapping

`MediaCreationTool.bat` picks the OS version/edition to fetch through a small,
hand-curated table:

- `set VERSIONS=1507,1511,1607,...,11_24H2,11_25H2` (around line 59) lists every
  supported version string, in order, and `set /a dV=19` sets the dialog's
  default selection index into that same list.
- Each version has a matching `:choice-N` label further down the script (around
  lines 149-260), where `N` is the 1-based position of that version in
  `VERSIONS` - e.g. `VERSIONS` item 19 is `11_25H2`, and `:choice-19` sets
  `VER`, `VID`, `CB`, `CT`, `CC`, `CAB` and `EXE` for 11 25H2; item 3 is `1607`
  and `:choice-3` configures that release, and so on down to item 1 (`1507`,
  `:choice-1`).
- Adding a new release means appending its name to `VERSIONS`, bumping `dV` if
  it should be the new default, and adding a new `:choice-N` block (copied from
  the previous newest one) with that release's `VER`/`VID`/`CB`/`CT`/`CC`/
  `CAB`/`EXE` values.

## Changelog

There is a single changelog, kept in two places that should stay in sync: the
header comment block at the top of `MediaCreationTool.bat` (`:: Changelog:`,
around lines 6-13) and the `Changelog` section near the bottom of `README.md`.
Add a dated entry to both when a change is user-visible.
