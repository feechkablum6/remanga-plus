; ReManga Plus -- Windows installer (ASCII-only on purpose: NSIS 3 rejects
; non-ASCII bytes without an explicit UTF-8 BOM. Keep this file pure ASCII
; so makensis works out of the box.)
; Build with: makensis -DEXTENSION_ID=<id> -DVERSION=<x.y.z> installer.nsi
; Per-user install, no UAC, no admin rights.

!include "MUI2.nsh"

!define APPNAME "Remanga Plus"
!define COMPANYNAME "remanga.org"
!define HOSTNAME "org.remanga.parser_host"

!ifndef EXTENSION_ID
  !error "EXTENSION_ID must be defined via -DEXTENSION_ID=<chrome-extension-id>"
!endif
!ifndef VERSION
  !error "VERSION must be defined via -DVERSION=<x.y.z>"
!endif

Name "${APPNAME}"
OutFile "Remanga-Plus-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Remanga Plus"
RequestExecutionLevel user
; zlib compressor: arm64 makensis 3.12's LZMA implementation OOMs on the
; bundled ~70 MB node.exe (both /SOLID and per-file modes throw std::bad_alloc).
; zlib is less compact (~30% larger installer) but stable.
SetCompressor zlib
ShowInstDetails show
ShowUninstDetails show

!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "English"

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "CompanyName" "${COMPANYNAME}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "${APPNAME} Installer"

Section "Install"
    SetOutPath "$INSTDIR"

    File "node.exe"
    File "parser-server.js"
    File "host.js"
    File "host.bat"
    File /r "extension"

    ; Generate Native Messaging manifest with absolute host path + extension id.
    FileOpen $0 "$INSTDIR\nm-manifest.json" w
    FileWrite $0 '{$\n'
    FileWrite $0 '  "name": "${HOSTNAME}",$\n'
    FileWrite $0 '  "description": "Autostarts the local parser-server for ReManga Premium Free",$\n'
    FileWrite $0 '  "path": "$INSTDIR\\host.bat",$\n'
    FileWrite $0 '  "type": "stdio",$\n'
    FileWrite $0 '  "allowed_origins": ["chrome-extension://${EXTENSION_ID}/"]$\n'
    FileWrite $0 '}$\n'
    FileClose $0

    ; Register Native Messaging host for every known Chromium browser (HKCU only).
    ; Browsers that aren't installed will simply ignore their key -- harmless.
    WriteRegStr HKCU "Software\Google\Chrome\NativeMessagingHosts\${HOSTNAME}" "" "$INSTDIR\nm-manifest.json"
    WriteRegStr HKCU "Software\Google\Chrome Beta\NativeMessagingHosts\${HOSTNAME}" "" "$INSTDIR\nm-manifest.json"
    WriteRegStr HKCU "Software\Google\Chrome Dev\NativeMessagingHosts\${HOSTNAME}" "" "$INSTDIR\nm-manifest.json"
    WriteRegStr HKCU "Software\Google\Chrome SxS\NativeMessagingHosts\${HOSTNAME}" "" "$INSTDIR\nm-manifest.json"
    WriteRegStr HKCU "Software\Microsoft\Edge\NativeMessagingHosts\${HOSTNAME}" "" "$INSTDIR\nm-manifest.json"
    WriteRegStr HKCU "Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\${HOSTNAME}" "" "$INSTDIR\nm-manifest.json"
    WriteRegStr HKCU "Software\Vivaldi\NativeMessagingHosts\${HOSTNAME}" "" "$INSTDIR\nm-manifest.json"
    WriteRegStr HKCU "Software\Chromium\NativeMessagingHosts\${HOSTNAME}" "" "$INSTDIR\nm-manifest.json"
    WriteRegStr HKCU "Software\Yandex\YandexBrowser\NativeMessagingHosts\${HOSTNAME}" "" "$INSTDIR\nm-manifest.json"
    WriteRegStr HKCU "Software\Opera Software\Opera Stable\NativeMessagingHosts\${HOSTNAME}" "" "$INSTDIR\nm-manifest.json"

    ; Uninstaller registration in Add/Remove Programs (per-user -> HKCU).
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "DisplayName" "${APPNAME}"
    WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "DisplayVersion" "${VERSION}"
    WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "Publisher" "${COMPANYNAME}"
    WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "InstallLocation" "$INSTDIR"
SectionEnd

Section "Uninstall"
    ; Remove files.
    Delete "$INSTDIR\node.exe"
    Delete "$INSTDIR\parser-server.js"
    Delete "$INSTDIR\host.js"
    Delete "$INSTDIR\host.bat"
    Delete "$INSTDIR\nm-manifest.json"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir /r "$INSTDIR\extension"
    RMDir "$INSTDIR"

    ; Remove cache.
    RMDir /r "$LOCALAPPDATA\Remanga Plus"

    ; Remove Native Messaging registrations.
    DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\${HOSTNAME}"
    DeleteRegKey HKCU "Software\Google\Chrome Beta\NativeMessagingHosts\${HOSTNAME}"
    DeleteRegKey HKCU "Software\Google\Chrome Dev\NativeMessagingHosts\${HOSTNAME}"
    DeleteRegKey HKCU "Software\Google\Chrome SxS\NativeMessagingHosts\${HOSTNAME}"
    DeleteRegKey HKCU "Software\Microsoft\Edge\NativeMessagingHosts\${HOSTNAME}"
    DeleteRegKey HKCU "Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\${HOSTNAME}"
    DeleteRegKey HKCU "Software\Vivaldi\NativeMessagingHosts\${HOSTNAME}"
    DeleteRegKey HKCU "Software\Chromium\NativeMessagingHosts\${HOSTNAME}"
    DeleteRegKey HKCU "Software\Yandex\YandexBrowser\NativeMessagingHosts\${HOSTNAME}"
    DeleteRegKey HKCU "Software\Opera Software\Opera Stable\NativeMessagingHosts\${HOSTNAME}"

    ; Remove Add/Remove Programs entry.
    DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}"
SectionEnd
