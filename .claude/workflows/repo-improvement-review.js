export const meta = {
  name: 'repo-improvement-review',
  description: 'Examine the repo across six dimensions, adversarially verify findings, and synthesize an improvement report',
  phases: [
    { title: 'Find', detail: 'six Sonnet 5 finders, one per dimension', model: 'claude-sonnet-5' },
    { title: 'Verify', detail: 'one Sonnet 5 refuter per finding', model: 'claude-sonnet-5' },
    { title: 'Synthesize', detail: 'merge verified findings into a report', model: 'claude-sonnet-5' },
  ],
}

const MODEL = 'claude-sonnet-5'
const MAX_PER_DIM = 4

const CONTEXT = `Repository: /home/user/11_25H2-MediaCreationTool.bat (a Windows batch project).
Files: MediaCreationTool.bat (~140KB, main script, hybrid bat/PowerShell), README.md, LICENSE, .gitattributes, .gitignore, preview.png,
bypass11/{readme.md, auto.cmd, Quick_11_iso_esd_wim_TPM_toggle.bat, windows_update_refresh.bat, AutoUnattend.xml, Skip_TPM_Check_on_Dynamic_Update.cmd}.
Read the actual files with cat/sed/grep before reporting anything. Cite file and line numbers. Only report things you can point to in the code.`

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          kind: { type: 'string', enum: ['bug', 'security', 'robustness', 'docs', 'maintainability', 'expansion', 'hygiene'] },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          evidence: { type: 'string', description: 'quoted code or text that demonstrates the issue' },
          problem: { type: 'string' },
          suggestion: { type: 'string', description: 'concrete fix or expansion, with a code sketch when practical' },
        },
        required: ['title', 'kind', 'severity', 'file', 'evidence', 'problem', 'suggestion'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
    corrected_severity: { type: 'string', enum: ['high', 'medium', 'low'] },
    refined_suggestion: { type: 'string' },
  },
  required: ['refuted', 'reason', 'corrected_severity'],
}

const DIMENSIONS = [
  { key: 'bat-correctness', prompt: `${CONTEXT}
Dimension: CORRECTNESS of MediaCreationTool.bat. Hunt for real bugs: batch quoting/escaping errors, delayed-expansion pitfalls, wrong error handling, dead code, broken label jumps, PowerShell/batch boundary issues, version-table mistakes (build numbers, editions, languages), incorrect URLs or product keys, logic that will misbehave on current Windows 10/11 builds. Ignore style.` },
  { key: 'bypass11-scripts', prompt: `${CONTEXT}
Dimension: CORRECTNESS and ROBUSTNESS of everything under bypass11/. Check registry keys and values against current Windows 11 setup behavior (LabConfig, MoSetup AllowUpgradesWithUnsupportedTPMOrCPU, appraiserres.dll handling, Dynamic Update skip), AutoUnattend.xml validity, and interactions between the scripts. Report anything stale, wrong, or fragile.` },
  { key: 'security', prompt: `${CONTEXT}
Dimension: SECURITY and SAFETY. Look at how files are downloaded (HTTP vs HTTPS, hash/signature verification, TLS settings), elevation and UAC handling, registry edits, temp-file handling, PowerShell execution policy bypasses, any hardcoded credentials/keys, and anything a tampered network or a malicious ISO could exploit. Distinguish inherent-to-the-tool risks from fixable weaknesses; report only fixable ones.` },
  { key: 'docs', prompt: `${CONTEXT}
Dimension: DOCUMENTATION accuracy and completeness. Compare README.md and bypass11/readme.md against what the scripts actually do (options, presets, supported versions, flags, file names, behavior on failure). Report mismatches, missing usage docs, unclear sections, and missing troubleshooting/FAQ content that the code implies users will need.` },
  { key: 'expansion', prompt: `${CONTEXT}
Dimension: EXPANSIONS and FEATURES. Based on the code, propose concrete additions that fit the project's scope: newer Windows builds/versions not yet in the version table, missing language or edition coverage, extra presets (e.g. checksum verification, unattended install options), better logging/diagnostics, argument parsing improvements, or configuration file support. Each proposal must reference where in the code it would plug in.` },
  { key: 'hygiene', prompt: `${CONTEXT}
Dimension: REPO HYGIENE and MAINTAINABILITY. Check .gitattributes/.gitignore (CRLF handling for .bat/.cmd is critical), line endings in the actual files (use 'file' and 'grep -c $'\\r'), absence of CI/lint (e.g. a GitHub Actions job that checks CRLF and runs a batch syntax smoke test), contribution docs, changelog, versioning of the script, giant-file structure (sections that could be split or documented), and LICENSE consistency with README.` },
]

phase('Find')
const finderPrompt = (d) => `${d.prompt}

Return up to ${MAX_PER_DIM} findings, best first. Skip anything speculative or purely stylistic.`

const results = await pipeline(
  DIMENSIONS,
  d => agent(finderPrompt(d), { label: `find:${d.key}`, phase: 'Find', schema: FINDINGS_SCHEMA, model: MODEL }),
  (found, d) => {
    if (!found) { log(`finder ${d.key} returned nothing`); return [] }
    const list = found.findings.slice(0, MAX_PER_DIM)
    if (found.findings.length > MAX_PER_DIM) log(`${d.key}: kept ${MAX_PER_DIM} of ${found.findings.length} findings`)
    return list.map(f => ({ ...f, dimension: d.key }))
  },
  (findings, d) => parallel(findings.map((f, i) => () =>
    agent(`${CONTEXT}
You are a skeptical reviewer. Another reviewer claims the following about this repo. Read the cited file and lines yourself and try to REFUTE it.
Refute if: the code does not say what is claimed, the behavior is intentional and documented, the issue is not reachable, or the suggestion would break something. If uncertain, set refuted=true.
If it stands, give the correct severity and a tightened, actionable suggestion.

Claim:
${JSON.stringify(f, null, 2)}`,
      { label: `verify:${d.key}#${i + 1}`, phase: 'Verify', schema: VERDICT_SCHEMA, model: MODEL })
      .then(v => v ? { ...f, verdict: v } : null)
  ))
)

const all = results.filter(Boolean).flat().filter(Boolean)
const confirmed = all.filter(f => !f.verdict.refuted)
  .map(f => ({ ...f, severity: f.verdict.corrected_severity || f.severity, suggestion: f.verdict.refined_suggestion || f.suggestion }))
const refuted = all.filter(f => f.verdict.refuted)
log(`${confirmed.length} findings confirmed, ${refuted.length} refuted`)

phase('Synthesize')
const report = await agent(`${CONTEXT}
Write a Markdown report titled "Repository review: findings and suggested improvements" from the verified findings below.
Structure: 1) one-paragraph summary, 2) "Fixes" table (severity, file:line, problem, fix) sorted high→low, 3) "Expansions" list, 4) "Docs and hygiene" list, 5) "Suggested order of work" (numbered, quick wins first).
Keep each item tight; keep the code sketches from suggestions when useful, in fenced blocks. Do not invent findings. Return ONLY the Markdown.

Confirmed findings:
${JSON.stringify(confirmed, null, 2)}

Refuted (mention briefly in a final "Checked and dismissed" section, one line each):
${JSON.stringify(refuted.map(f => ({ title: f.title, file: f.file, reason: f.verdict.reason })), null, 2)}`,
  { label: 'synthesize', phase: 'Synthesize', model: MODEL })

return { report, confirmedCount: confirmed.length, refutedCount: refuted.length, confirmed, refuted }