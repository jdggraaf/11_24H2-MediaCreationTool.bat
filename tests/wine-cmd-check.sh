#!/usr/bin/env bash
# Runs pieces of MediaCreationTool.bat under Wine's cmd.exe (best effort - Wine's cmd cannot parse several idioms
# real cmd.exe handles, e.g. `&` inside a for-body, so only the pieces below are tested here).
set -u
cd "$(dirname "$0")/.."
command -v wine >/dev/null || { echo "skip wine-cmd (wine not installed)"; exit 0; }
export WINEDEBUG=-all; export WINEPREFIX=${WINEPREFIX:-$HOME/.wine-mct}
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
python3 - "$T" <<'PY'
import sys; T=sys.argv[1]
L=open('MediaCreationTool.bat','rb').read().decode('latin1').split('\r\n')
find=lambda s: next(i for i,l in enumerate(L) if s in l)
crlf=lambda ls: ('\r\n'.join(ls)+'\r\n').encode('latin1')
# ini loader + version resync + tokens + dynamic-update substitution, exact lines from the script
ini=L[find('MediaCreationTool.ini") do if not defined')]; vid=L[find('for /f "tokens=%MCT% delims=,"')].replace('if defined GUI ','')
tok=L[find('set "GUI_TOKENS=" & for %%s in')]; sub=L[find('if defined GUI_NO_UPDATE if')]
open(f'{T}/MediaCreationTool.ini','wb').write(b'MCT=11_25H2\r\nEDITION=Pro\r\nNO_UPDATE=1\r\n; comment\r\n')
open(f'{T}/t1.bat','wb').write(crlf(['@echo off',ini,'echo MCT=%MCT% EDITION=%EDITION% NO_UPDATE=%NO_UPDATE%',
 'set VERSIONS=1703,1709,11_25H2&set MCT=3',vid,'echo VID=%VID%',
 'set GUI_EDITION=Enterprise&set GUI_LANGCODE=de-DE&set GUI_ARCH=-&set GUI_KEY=-&set GUI_NO_UPDATE=no_update&set GUI_DEF=-',tok,'echo TOKENS=[%GUI_TOKENS%]',
 'set OPTIONS=/Compat IgnoreWarning /DynamicUpdate Enable',sub,'echo OPTIONS=%OPTIONS%']))
i=find(':help'); j=next(k for k in range(i,len(L)) if L[k].startswith('pause'))
open(f'{T}/t2.bat','wb').write(crlf(['@echo off']+L[i+1:j]))
PY
cd "$T"; fail=0
wine cmd /c "t1.bat > t1.txt 2>&1"; cat t1.txt
grep -q 'MCT=11_25H2 EDITION=Pro NO_UPDATE=1' t1.txt && grep -q 'VID=11_25H2' t1.txt && grep -q 'TOKENS=\[ Enterprise de-DE no_update\]' t1.txt && grep -q 'DynamicUpdate Disable' t1.txt \
  && echo "ok   ini loader, version resync, tokens, dynamic-update substitution" || { echo "FAIL t1"; fail=1; }
wine cmd /c "t2.bat > t2.txt 2>&1"; n=$(grep -c 'MediaCreationTool' t2.txt)
[ "$n" -ge 3 ] && ! grep -qi 'not recognized\|syntax error' t2.txt && echo "ok   help text ($(wc -l < t2.txt) lines)" || { echo "FAIL help"; cat t2.txt; fail=1; }
exit $fail
