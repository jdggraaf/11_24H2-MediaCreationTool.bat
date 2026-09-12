export const meta = {
  name: 'implement-and-verify-fixes',
  description: 'Implement the confirmed REVIEW.md fixes per file group, run static tests, adversarially verify each change, and check completeness',
  phases: [
    { title: 'Implement', detail: 'three Sonnet 5 agents, disjoint file sets', model: 'claude-sonnet-5' },
    { title: 'Test', detail: 'static checks + line-by-line diff trace', model: 'claude-sonnet-5' },
    { title: 'Verify', detail: 'one skeptic per fix', model: 'claude-sonnet-5' },
    { title: 'Completeness', detail: 'anything in REVIEW.md left undone?', model: 'claude-sonnet-5' },
  ],
}

const MODEL = 'claude-sonnet-5'
const REPO = '/home/user/11_25H2-MediaCreationTool.bat'

const RULES = `Repository: ${REPO}. Windows batch/PowerShell project reviewed in REVIEW.md (read it first).
HARD RULES for edits:
- All .bat/.cmd/.xml files use CRLF line endings. Every line you add or change MUST end in CRLF. Verify after editing with: bash tests/static-check.sh (it checks CRLF, XML, labels, PowerShell brace balance). It must print ALL CHECKS PASSED for the parts you own before you finish.
- Prefer python3 for edits so you control line endings exactly (open in binary mode, replace exact byte strings, write back). Do not use sed -i on CRLF files unless you preserve \\r.
- Keep edits minimal and in the file's existing style (AveYo's terse batch style, 2-space indented PowerShell). No reformatting of untouched lines.
- Do not run git commit or git push. Leave changes in the working tree.
- Do not touch files outside your assigned set.`

const EDIT_RESULT = {
  type: 'object',
  properties: {
    changes: { type: 'array', items: { type: 'object', properties: {
      file: { type: 'string' }, finding: { type: 'string' }, what: { type: 'string' }, lines: { type: 'string' } },
      required: ['file', 'finding', 'what'] } },
    skipped: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, why: { type: 'string' } }, required: ['finding', 'why'] } },
    static_check_passed: { type: 'boolean' },
  },
  required: ['changes', 'skipped', 'static_check_passed'],
}

const GROUPS = [
  { key: 'main-bat', files: 'MediaCreationTool.bat only', task: `Implement these REVIEW.md fixes in MediaCreationTool.bat:
1. DOWNLOAD (~line 1064): change 'foreach ($url in $http, $https)' to 'foreach ($url in $https, $http)'.
2. FETCH_25H2_CAB (~939-1055): the registry values $build/$ubr/$editionId (lines ~946-948) are read but unused. Derive $lcuVersion and $mediaVersion as "10.0.$build.$ubr" when both are non-empty numerics, else keep the existing literal as fallback. Use $env:EDITION when set (else $editionId, else the existing literal) for EditionId, and keep CompositionEditionId=Enterprise unless $env:EDITION is set to something else non-empty. Leave $targetVersion and OSVersion baseline as they are (the report says leave them). Update the comment above accordingly.
3. Authenticode check before executing the downloaded MCT exe (the 'if "MCT Defaults" equ "%PRESET%" (start MediaCreationTool%VID%.exe ...' line ~414 and the later launch paths): the simplest robust place is right after the err-check block (~line 402-404): add a batch line that runs powershell -nop -c to Get-AuthenticodeSignature on MediaCreationTool%VID%.exe and exits non-zero unless Status -eq 'Valid' and SignerCertificate.Subject matches 'Microsoft Corporation'; on failure print an ERROR in the script's existing %<%:4f " ERROR "%>>% style, delete the exe, pause, exit /b1. Keep it on one or two lines in the file's style. Make sure quoting works inside batch (use single quotes inside the powershell -c string, escape % as %% only where batch needs it).
4. Mirror the unattend ProductVersion policy: in the embedded <unattend> block (~line 855-862) add a RunSynchronousCommand with the next Order number: reg add HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate /v ProductVersion /d "Windows 11" /t reg_sz /f. Renumber later Orders if they are sequential (check!). Inside XML, quotes in Path are fine as literal ".
Also: add the products CAB to the err-check line (~402) ONLY if it is safe: check how products.xml is produced when CAB is set vs when only XML is set; if adding it would falsely fail a valid non-CAB path, skip and explain.
Finally bump the changelog header at the top of the file (lines ~6-13) with a dated entry (2026.09.12) summarising these changes in the existing style.` },
  { key: 'bypass11', files: 'bypass11/windows_update_refresh.bat, bypass11/Skip_TPM_Check_on_Dynamic_Update.cmd, bypass11/AutoUnattend.xml only', task: `Implement these REVIEW.md fixes:
1. In windows_update_refresh.bat (self-elevation at lines 6-7) and Skip_TPM_Check_on_Dynamic_Update.cmd (lines 45-46): after the script is confirmed elevated (the line right after the 'fltmc||' re-launch line), add: >nul 2>nul reg delete hkcu\\software\\classes\\.Admin /f   — so the runas association is removed once elevated. Confirm by reading the code that the deletion happens only in the elevated instance and cannot break the re-launch (the non-elevated instance exits before reaching it).
2. In AutoUnattend.xml add a RunSynchronousCommand with the next Order number after the TargetReleaseVersionInfo command: reg add HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate /v ProductVersion /d "Windows 11" /t reg_sz /f. Renumber subsequent Order values so they stay sequential and unique. Validate with xmllint --noout.` },
  { key: 'docs', files: 'README.md, bypass11/readme.md, .gitattributes, CONTRIBUTING.md (new) only', task: `Implement these REVIEW.md docs/hygiene items:
1. bypass11/readme.md: remove/update stale v7/V9 version labels for Skip_TPM_Check_on_Dynamic_Update.cmd (script self-identifies as V13, 2023.12.07); replace the pastebin link for windows_update_refresh.bat with a relative link to the in-repo file; add notes for Quick_11_iso_esd_wim_TPM_toggle.bat about running it bare (installs/uninstalls its SendTo shortcut, see script lines 7-18) and the optional second argument 1/0 forcing patch/undo (lines 20-21). Read the script to confirm before writing.
2. README.md: append a changelog entry matching the script header's 2026.01.15 entry (read MediaCreationTool.bat lines 6-13) and a 2026.09.12 entry: HTTPS-first downloads, Authenticode check of the MCT exe, 25H2 CAB fetch uses live build/UBR/edition, ProductVersion policy added, .Admin runas cleanup in bypass11 scripts, static test script tests/static-check.sh. Keep README's existing changelog format.
3. .gitattributes: keep the '* -text' rule (do NOT switch to text eol=crlf) but add a comment line explaining why (CRLF must be preserved byte-for-byte for cmd.exe) and explicit '-text' lines for *.bat *.cmd *.xml for documentation value.
4. Create CONTRIBUTING.md (short): CRLF requirement, how to run tests/static-check.sh, the :choice-N <-> VERSIONS mapping in MediaCreationTool.bat (read lines ~55-62 and ~149-260 to describe it accurately), and where the changelog lives.
Both README.md and bypass11/readme.md currently use CRLF; keep it that way.` },
]

phase('Implement')
const impl = await parallel(GROUPS.map(g => () =>
  agent(`${RULES}\nYour files: ${g.files}.\n\n${g.task}\n\nReturn every change you made with file and approximate lines, anything you deliberately skipped with a reason, and whether bash tests/static-check.sh passed.`,
    { label: `implement:${g.key}`, phase: 'Implement', schema: EDIT_RESULT, model: MODEL })))
const implOk = impl.filter(Boolean)
log(`implemented: ${implOk.flatMap(r => r.changes).length} changes, ${implOk.flatMap(r => r.skipped).length} skipped`)

phase('Test')
const TEST_SCHEMA = { type: 'object', properties: {
  static_check_output: { type: 'string' }, passed: { type: 'boolean' },
  problems: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'integer' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['file', 'problem'] } },
}, required: ['passed', 'problems', 'static_check_output'] }

const tests = await agent(`${RULES.split('HARD RULES')[0]}
You are the TEST stage. There is no Windows, Wine or PowerShell in this container, so testing is static. Do all of the following and report problems precisely:
1. Run: bash tests/static-check.sh  — capture full output.
2. Run: git diff  — read every hunk. For each changed line in a .bat/.cmd file, check: ends with \\r\\n (use git diff | cat -A), batch quoting/escaping is valid (%% inside for-loops, ^ escapes, & chaining, parentheses balance inside if blocks, no unescaped ) inside a parenthesised block), delayed expansion not required where !var! isn't enabled.
3. For the new Authenticode line: mentally execute the powershell -nop -c "..." string as cmd.exe would parse it (cmd strips its own quotes and % expansions first, then PowerShell parses). Confirm the exit code propagates so the batch 'if errorlevel' / '||' logic triggers on failure. Confirm it will not false-fail on a legitimately Microsoft-signed exe (Subject contains 'CN=Microsoft Corporation').
4. For FETCH_25H2_CAB changes: mentally execute the PowerShell with $build='26100', $ubr='4351', $env:EDITION unset, then with $env:EDITION='Professional'. Confirm variables are defined before use, string formatting is right, and the catch fallback still works.
5. For the XML changes: xmllint --noout both bypass11/AutoUnattend.xml and the embedded block; confirm Order values are unique and sequential within each RunSynchronous.
6. For the bypass11 self-elevation edit: trace the non-elevated instance path and the elevated path and confirm the reg delete only executes in the elevated instance after 'fltmc' succeeds.
7. For docs: check all relative links in README.md and bypass11/readme.md resolve to existing files.
Do NOT edit any files. Report each problem with file, line, what is wrong, and the exact fix.`,
  { label: 'test:static+trace', phase: 'Test', schema: TEST_SCHEMA, model: MODEL, effort: 'high' })
log(`tests passed=${tests ? tests.passed : 'n/a'}, problems=${tests ? tests.problems.length : 'n/a'}`)

phase('Verify')
const changes = implOk.flatMap(r => r.changes)
const VERDICT = { type: 'object', properties: {
  correct: { type: 'boolean' }, matches_finding: { type: 'boolean' }, reason: { type: 'string' },
  required_fix: { type: 'string' } }, required: ['correct', 'matches_finding', 'reason'] }
const verdicts = await parallel(changes.map((c, i) => () =>
  agent(`${RULES.split('HARD RULES')[0]}
You are a skeptical reviewer. Read REVIEW.md, then run git diff -- "${c.file}" and read the surrounding code. Judge this single change:
${JSON.stringify(c, null, 2)}
Questions: Does it actually fix the finding it claims (matches_finding)? Is it correct and safe on real Windows cmd.exe/PowerShell 5.1 (correct)? Could it break any existing path (e.g. non-25H2 versions, MCT Defaults preset, non-elevated runs, unattended AUTO mode)? Preserve CRLF? If anything is wrong, give the exact required_fix. Default to correct=false if uncertain. Do NOT edit files.`,
    { label: `verify:${c.file.split('/').pop()}#${i + 1}`, phase: 'Verify', schema: VERDICT, model: MODEL })
    .then(v => v ? { change: c, verdict: v } : null)))
const bad = verdicts.filter(Boolean).filter(v => !v.verdict.correct || !v.verdict.matches_finding)
log(`verify: ${verdicts.filter(Boolean).length - bad.length} ok, ${bad.length} flagged`)

phase('Completeness')
const COMPLETE = { type: 'object', properties: {
  done: { type: 'array', items: { type: 'string' } },
  not_done: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, reason_or_recommendation: { type: 'string' } }, required: ['item', 'reason_or_recommendation'] } },
}, required: ['done', 'not_done'] }
const completeness = await agent(`${RULES.split('HARD RULES')[0]}
Read REVIEW.md sections "Fixes", "Docs and hygiene" and "Suggested order of work". Run git status and git diff --stat and git diff. For each item, say whether it is now implemented in the working tree. Items in "Expansions" are out of scope except the ones explicitly listed under Fixes/Docs. Do NOT edit files.
Implementers reported skipping: ${JSON.stringify(implOk.flatMap(r => r.skipped))}`,
  { label: 'completeness', phase: 'Completeness', schema: COMPLETE, model: MODEL })

return { impl: implOk, tests, flagged: bad, verdicts: verdicts.filter(Boolean), completeness }