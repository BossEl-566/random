export {};

declare global {
  interface Window {
    desktopAPI?: {
      isElectron: boolean;
      platform: string;
      versions: {
        electron: string;
        chrome: string;
        node: string;
      };
    };
  }
}