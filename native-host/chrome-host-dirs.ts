const CHROME_CHANNELS = ["Chrome", "Chrome Beta", "Chrome Dev", "Chrome Canary"];

export const resolveChromeHostDirs = (
  homedir: string,
  dirExists: (path: string) => boolean,
): string[] => {
  const directories: string[] = [];
  for (const channel of CHROME_CHANNELS) {
    const profileRoot = `${homedir}/Library/Application Support/Google/${channel}`;
    if (dirExists(profileRoot)) {
      directories.push(`${profileRoot}/NativeMessagingHosts`);
    }
  }
  return directories;
};
