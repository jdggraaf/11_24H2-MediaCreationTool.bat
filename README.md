Not just an Universal MediaCreationTool wrapper script with ingenious support for business editions,  
<img src="preview.png">  
A powerful yet simple windows 10 / 11 deployment automation tool as well!  
*If you had no success launching the script so far, this latest version will work*  

> **About this fork.** Original work by [AveYo](https://github.com/AveYo/MediaCreationTool.bat), whose repository
> remains the upstream and the source of everything from 1507 through 24H2. This fork
> (`jdggraaf`, via `lzw29107`) adds Windows 11 25H2 support with a live catalog fetch and the extended TPM
> bypasses. The in-script `latest_MCT.url` shortcut still points at AveYo's repo by design — that is the
> canonical upstream. Screenshot above predates the 25H2 entry.

**25H2 CAB Fetch** — Dynamically fetch 25H2 media metadata directly from Microsoft's Update Metadata Service, with automatic country/language detection via `LANGCODE`. Falls back to Microsoft's static Download Center catalog if the live service is unreachable, so the script no longer aborts when the fetch fails.

Which Windows version do I get?
------------------------------
Verified against Microsoft's live catalogs on **2026-07-29**:

| Choice | Build the media contains | Notes |
| --- | --- | --- |
| `11_25H2` | `26200.8875.260711-1836` | current retail media, fetched live — newest available |
| `11_24H2` | `26100.4349.250607-1500` | static cab, still the current 24H2 media |
| `22H2` (Win 10) | `19045.3803.231204-0204` | frozen; Windows 10 media has not been refreshed since EOL |

Windows 10 22H2 media is final at `19045.3803` and will not change — Windows 10 reached end of support on 2025-10-14, and consumer Extended Security Updates end **2026-10-13**. Security fixes since then ship through Windows Update only, never in the installation media.

**There is deliberately no 26H1 or 26H2 entry**, and adding one today would not work:

- **26H1** (build `28000`) is a hardware-enablement release shipped **preinstalled on ARM64 Snapdragon X2 devices only**. Microsoft publishes no MCT media or upgrade path for it, so there is nothing for this script to fetch.
- **26H2** (build `26300`) is an *enablement package* over the same 25H2 platform, due **fall 2026**. Until it reaches GA the MCT still serves 25H2.

Because the live fetch always returns whatever Microsoft currently publishes, 25H2 media stays current on its own — the hardcoded build is only a label, and the script now prints the catalog's real build when the two differ.

Adding a new version
--------------------
Version metadata used to be spread over five places that could silently drift apart. It is now **two**:

1. A row in the `VTABLE` version table near the top of the script — `index:menu-name:alternative-alias`.
2. The matching `:choice-NN` block holding that version's `VER` / `VID` / `CB` / `CT` / `CC` and its `CAB` / `XML` / `EXE` sources.

The menu list (`VERSIONS`), the default index (`dV`), the script-name and commandline aliases, and the `VIS` / `X`
display labels are all derived from that table at runtime. A menu name beginning with `11_` is what marks a row as
Windows 11, so `15:11_26H2:2609` would classify itself with no further code changes.

So when 26H2 ships, it is one table row plus one choice block:

```
set VTABLE=%VTABLE% 20:11_26H2:2609
:choice-20
set "VER=26300" & set "VID=11_26H2" & set "CB=<build tag>" & set "CT=<yyyy/mm/>" & set "CC=2.1"
set "CAB=FETCH"
set "XML=<static Download Center catalog url>"
set "EXE=https://go.microsoft.com/fwlink/?linkid=2156295"
goto process
```

**TPM Bypass Enhancements** — Comprehensive hardware requirement spoofing for WinPE and upgrade scenarios:
- `HwReqChk` registry key for spoofing hardware capabilities
- LabConfig registry bypasses: `BypassTPMCheck`, `BypassSecureBootCheck`, `BypassRAMCheck`, `BypassCPUCheck`, `BypassStorageCheck`
- `AllowUpgradesWithUnsupportedTPMorCPU` for MoSetup upgrade scenarios
- Maintains existing appraiserres.dll and winsetup.dll bypass mechanisms

Presets  
-------  
1 ***Auto Upgrade*** with detected media, script assists setupprep for upgrading directly  
> _- can keep files and apps on more scenarios where os and target edition does not match_  
> _- can switch detected edition by adding EditionID to script name_  
> _- can troubleshoot upgrade failing by adding `no_update` to script name_  
> _- auto defaults to 11, so pass version as well for 10: `auto 21H2 MediaCreationTool.bat`_  

2 ***Auto ISO*** with detected media in current folder directly _(or C:\ESD if run from zip)_  
> _- can override detected media by adding edition name / language / arch to script name_  
> _- example: `21H1 Education en-US x86 iso MediaCreationTool.bat`_  

3 ***Auto USB*** with detected media in specified usb target  
> _- for data safety, this is not fully automated - must select the usb drive manually in GUI_  

4 ***Select*** with user picked Edition, Language, Arch (x86,x64,both) - on specified target  
> _- implicit choice, includes setup override files (disable by adding `def` to script name)_  

5 ***MCT Defaults*** runs unassisted, creating media without script modification  
> _- no added files, script passes `products.xml` to MCT and quits without touching media_  

1-4 presets will modify created media in the following ways:  
> _- write `auto.cmd` to run on demand for auto upgrade with edition switch and skip tpm_  
> _- write `$ISO$` folder content (if it exists) at the root of the media_  
> _if you previously used $OEM$ content, must now place it in `$ISO$\sources\$OEM$\`_  
> _- write `sources\PID.txt` to preselect edition at media boot or within windows (if configured)_  
> _- write `sources\EI.cfg` to prevent product key prompt on Windows 11 consumer media (11 only)_  
> _- write `AutoUnattend.xml` in boot.wim to enable local account on Windows 11 Home (11 only)_  
> _- patch `winsetup.dll` in boot.wim to remove windows 11 setup checks when booting from media (11 only)_  
> _- can disable by adding `def` to script name for a default, untouched MCT media_  

Features  
--------
- **Automatic 25H2 media fetch** from Microsoft Update Metadata Service (FE3)
  - Queries with device attributes (build, architecture, country, edition, etc.)
  - Resolves signed URL and downloads 25H2 products.cab
  - Respects `LANGCODE` environment variable for country/region detection (e.g., `nl-NL` → `IsoCountryShortCode=NL`)
  - Fallback to host system culture if `LANGCODE` not set
  - Validates the cabinet signature, so a captive portal or error page cannot be mistaken for a catalog
  - Falls back to the static Download Center catalog if the service is unreachable, instead of aborting
  - The MCT executable is resolved through Microsoft's `fwlink`, so it tracks the current tool without link maintenance
- **TPM Bypass Enhancements** for unsupported hardware scenarios
  - `HwReqChk` registry key spoofs hardware capabilities in WinPE and upgrade scenarios
  - LabConfig registry bypasses for: TPM, SecureBoot, RAM, CPU, Storage checks
  - `AllowUpgradesWithUnsupportedTPMorCPU` for MoSetup-based upgrade scenarios
  - Maintains existing `appraiserres.dll` and `winsetup.dll` bypass mechanisms
  - Comprehensive registry configuration in AutoUnattend.xml for automatic application during setup

Simple deployment  
-----------------   
**auto.cmd** is behind ***Auto Upgrade*** preset via GUI  
Can run it fully unnatended by renaming script with `auto MediaCreationTool.bat`  
Makes it easy to upgrade keeping files and apps when the OS edition does not match the media  
Should allow upgrade from Ultimate, PosReady, Embedded, LTSC or Enterprise Eval as well  

Generated script is added to the created media so you can run it again at any time  
It is fairly generic - it will detect available editions in install.esd, pick a suitable index,  
then set EditionID in the registry to match; can even force another edition, keeping files and apps!  
On 11, it will try to skip setup checks (can disable this behavior with script var)  
Finally, it sets recommended setup options with least amount of issues on upgrades  

> Let's say the current OS is Enterprise LTSC 2019, and you use the business media to upgrade:  
> **auto.cmd** selects Enterprise index and adjust EditionID to Enterprise in the registry (backed up as EditionID_undo)  
> Maybe you also want to switch edition,  
> ex. by renaming the script to  `ProfessionalWorkstation MediaCreationTool.bat`:  
> **auto.cmd** selects Professional index and sets EditionID to ProfessionalWorkstation in the registry.  
>   
> Let's say the OS is Windows 7 Ultimate or PosReady, and you use the consumer media to upgrade:  
> **auto.cmd** selects Professional index, and sets EditionID to Professional or Enterprise, respectively.  
> In all cases, the script tries to pick an existing index, else a compatible one to keep files and apps on upgrade.  
>   
> Let's say you have a dozen PCs spread with versions: 7, 8.1, 10 and editions: Ultimate, Home, Enterprise LTSB..  
> If you need to upgrade all to the latest 10 version and only use Pro, you could rename the script as:  
> `auto 21H2 Pro MediaCreationTool.bat`  
>
> Can even add a VL / MAK / retail product key in the same way to take care of licensing differences.  
> The script also picks up any `$ISO$` folder in the current location - for $OEM$ branding, configuration, tweaks etc.  

Changelog  
---------  
_No need to right-click Run as Admin, script will ask itself. Directly saving the Raw files no longer breaks line endings_  
_We did it! We broke [the previous gist](https://git.io/MediaCreationTool.bat)_ ;) So this is the new home. **Thank you all!**  

[discuss on MDL](https://forums.mydigitallife.net/threads/universal-mediacreationtool-wrapper-script-create-windows-11-media-with-automatic-bypass.84168/)  

```
2018.10.10: reinstated 1809 [RS5]! using native xml patching for products.xml; fixed syntax bug with exit/b
2018.10.12: added data loss warning for RS5
2018.11.13: RS5 is officially back! + greatly improved choices dialog - feel free to use the small snippet in your own scripts
2019.05.22: 1903 [19H1]
2019.07.11: 1903 __release_svc_refresh__ and enable DynamicUpdate by default to grab latest CU
2019.09.29: UPDATED 19H1 build 18362.356 ; RS5 build 17763.379 and show build number
            added LATEST MCT choice to dinamically download the current version (all others have hard-coded links)
2019.11.16: 19H2 18363.418 as default choice (updated hard-coded links)
2020.02.29: 19H2 18363.592
2020.05.28: 2004 19041.264 first release
2020.10.29: 20H2 and aniversary script refactoring to support all MCT versions from 1507 to 20H2!!!
2020.10.30: hotfix utf-8, enterprise on 1909+
2020.11.01: fix remove unsupported options in older versions code breaking when path has spaces.. pff
2020.11.14: generate latest links for 1909,2004; all xml editing now in one go; resolved known cannot run script issues
2020.11.15: one-time clear of cached MCT, as script generates proper 1.0 catalog for 1507,1511,1703 since last update
            fixed compatibility with naked windows 7 powershell 2.0 / IPv6 / optional import $OEM$ / 1803+ business typo
            updated executables links for 1903 and 2004
2020.11.17: parse first commandline parameter as version, example: MediaCreationTool.bat 1909
2020.12.01: attempt to fix reported issues with 1703; no other changes (skipping 19042.630 leaked esd because it is broken)
2020.12.11: 20H2 19042.631; fixed pesky 1703 decryption bug on dual x86 + x64; improved cleanup; label includes version
2021.03.20: pre-release 21H1; optional auto upgrade or create media presets importing $OEM$ folder and key as PID.txt
2021.05.23: 21H1 release; enhanced script name args parsing, upgrade from embedded, auto.cmd / PID.txt / $OEM$ import
2021.06.06: create iso directly; enhanced dialogs; args from script name or commandline; refactoring is complete!
2021.08.04: done fiddling
2021.09.03: 21H2, both 10 and 11 [unreleased]
2021.09.25: Windows 11
            with Skip TPM Check on media boot as well as on dynamic update (standalone toggle script available)
            final touches for improved script reliability; enhanced auto upgrade preset; win 7 powershell 2.0 compatible
2021.09.30: fix Auto Setup preset not launching.. automatically
2021.10.04: fix for long standing tr localization quirks; Skip TPM Check v2 (ifeo-based instead of wmi)
2021.10.05: 11 22000.194 Release (rofl W11 MCT has limited capabilities, so still using 21H1 MCT because it works fine)
2021.10.09: outstanding refactoring around Windows 11 MCT; minimize while waiting MCT; unified 7 - 11 appearence
2021.10.20: create generic iso if no edition arg; use Downloads folder; no 11 setup checks on boot in VirtualBox; fixes #2
2021.10.23: 11 22000.258
            more intuitive presets; 11 setup override via AutoUnattend.xml or via boot.wim (for VirtualBox 5.x) with FIX arg
            only reliable ui automation; enhanced script output
2021.11.03: multiple download methods; improved automation; improved auto.cmd; moved autounattend.xml to boot.wim
            revising 11 setup bypass (wip) - not being content with any methods is the reason why I've not updated in a while
2021.11.09: skip windows 11 upgrade checks with setup.exe (not just auto.cmd); no server label; local account on 11 home
            auto.cmd has more fixes to keep files and apps on upgrade; reliable ui automation; alternative downloaders 
2021.11.15: 11 22000.318
            write output to script folder (or C:\ESD if run from zip); style: more consistent separation of arguments
            20H2 builds with esd size above 4GB that had to be reverted at 19042.631: en,de,es,pt,fr,it,jp,zh (MCT limits)
2021.11.16: 10 19044.1288 - official release of 10 21H2
            10 19043.1348 - newest 10 build - don't ask why ms is releasing these as such, it's not the first time
2021.12.07: skip windows 11 upgrade checks only via auto.cmd - just ignore server label, please
2021.12.15: fix regression with 1507-1709 not getting the correct fallback esd; fix dev '-noe' not autoclosing script
2021.12.22: improved auto.cmd handling of mismatched OS and target edition, obey 'def', 'auto' upgrades 7 to 10, not 11
2022.03.16: prevent launch errors when run from non-canonical paths; USBLayout progress; pickup $ISO$ dir to add on media
            DU in 11: auto installs 22000.556 atm; older skip_11_checks, without Server label; Home offline local account
2022.03.18: fix regression with Auto Upgrade; removed powershell -nop arg (issue #41); enhanced 11 AutoUnattend.xml
2022.03.20: stable - all issues ironed out; improved script ui; upgrade keeping files from Eval editions too
            last squash I promise ;)
```

Fork changelog
--------------
```
2025.xx.xx: 25H2 support with products.cab fetched live from Microsoft Update Metadata Service (FE3)
            TPM bypass enhancements: HwReqChk, LabConfig, MoSetup AllowUpgradesWithUnsupportedTPMorCPU
2026.07.29: 25H2 media refreshed to 26200.8875 (260711-1836) - was 26200.6899 (251011-1532)
            MCT exe now resolved via fwlink 2156295 instead of a hardcoded GUID url
            static Download Center catalog added as fallback when the live FE3 fetch fails
            fetched cab is validated (MSCF signature) before it is trusted
            catalogs from a previous run are cleared first - a failed download could reuse another version's products.xml
            the catalog's real media build is printed when it differs from the hardcoded menu label
            corrected the INSERT_BUSINESS comment: the CSV only ever applied to 14393,15063,18363,19041,19042,19043
            version metadata consolidated into one VTABLE - menu, aliases, dV and VIS/X are now derived from it
            FETCH_25H2_CAB renamed FETCH_CAB and made version-neutral; its FE3 spoof constants are documented
              and overridable via FETCH_TARGET / FETCH_OSVER / FETCH_LCU, so 26H2 needs no code change
            TLS 1.3 selection made conditional - referencing it on pre-.NET-4.8 hosts threw and killed the fetch
            documented that `exit /b %errorcode%` in the powershell stubs is deliberate, not a typo
            FIXED: every Windows 11 selection (index 15-19) was discarded when the script self-elevated, because
              the restore used a hardcoded "lss 15" bound left over from when 14 Windows 10 versions existed -
              the version dialog reappeared after the UAC prompt. Bound now comes from the table.
            FIXED: AutoUnattend.xml wrote AllowUpgradesWithUnsupportedTPMorCPU to
              HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Setup\MoSetup, which is not the key Windows reads.
              Corrected to HKLM\SYSTEM\Setup\MoSetup, matching auto.cmd and Microsoft's documented location.
```

Known broken
------------
- **Choices `1507` and `1511` cannot work.** Their only catalog source is `wscont.apps.microsoft.com`, which no
  longer resolves (NXDOMAIN). The script downloads their MCT executable fine, then fails on the catalog after
  working through every download method. There is no replacement URL; these two entries are effectively dead.
- Media built by this script carries a deliberate Windows Update pin (`TargetReleaseVersion` +
  `TargetReleaseVersionInfo=25H1`). `25H1` is **not a typo** — AveYo points the pin at a version that never
  existed to suppress the unsupported-hardware nag. Side effect: installed machines are not offered feature
  updates until that policy is cleared. Quality and security updates are unaffected.
