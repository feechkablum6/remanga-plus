Remanga Plus for Windows
========================

Installed files are in this folder:

  %LOCALAPPDATA%\Programs\Remanga Plus

What the installer already did:

  1. Installed the extension files into the extension folder.
  2. Installed bundled node.exe, parser-server.js, host.js, and host.bat.
  3. Registered the Native Messaging host for Chrome, Edge, Brave, Vivaldi,
     Chromium, Yandex, and Opera under the current Windows user.

One browser step is still required:

  1. Open chrome://extensions or edge://extensions.
  2. Enable Developer mode.
  3. Click Load unpacked.
  4. Select this folder:

     %LOCALAPPDATA%\Programs\Remanga Plus\extension

After the extension is loaded, open remanga.org. When Premium Free needs the
parser, the extension starts parser-server automatically through Native
Messaging. You do not need to run parser-server manually.

If Premium Free does not work:

  1. Open the extension popup.
  2. Check the Service status.
  3. Press the restart button if parser-server is down.
  4. Reload the remanga.org tab after reinstalling or reloading the extension.
