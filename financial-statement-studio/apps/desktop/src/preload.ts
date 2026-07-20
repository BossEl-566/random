import { contextBridge } from "electron";

const desktopApi = {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
};

contextBridge.exposeInMainWorld(
  "desktopAPI",
  desktopApi,
);