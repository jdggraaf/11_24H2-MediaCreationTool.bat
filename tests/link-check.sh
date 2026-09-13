#!/usr/bin/env bash
# Probes every URL referenced by MediaCreationTool.bat with a 1 KB ranged GET. Prints a status table; exits 1 if a URL
# fails that is not listed in tests/known-dead-links.txt (those have an Internet Archive fallback in the script).
cd "$(dirname "$0")/.."
fail=0
while read -r u; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 40 -A 'Mozilla/5.0' -r 0-1023 "$u" 2>/dev/null)
  case "$code" in 2*|3*) st=ok ;; *) st=FAIL ;; esac
  if [ "$st" = FAIL ] && grep -qxF "$u" tests/known-dead-links.txt; then st=dead-known; fi
  [ "$st" = FAIL ] && fail=1
  printf '%-10s %-4s %s\n' "$st" "$code" "$u"
done < <(tr -d '\r' < MediaCreationTool.bat | grep -oE 'https?://[A-Za-z0-9./_%?=&-]+' | grep -vE 'schemas.microsoft.com|w3.org|EULA_MCTool_$|b1.download.windowsupdate.com/$|fe3.delivery|web.archive.org' | sort -u)
echo "note: fe3.delivery.mp.microsoft.com uses a Microsoft-private CA (trusted by Windows, not by curl) and web.archive.org fallbacks are not probed here"
exit $fail
