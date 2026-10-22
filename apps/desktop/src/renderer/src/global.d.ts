import type { ZimoDesktopApi } from "@zimo/contracts";

declare global {
  interface Window {
    zimo: ZimoDesktopApi;
  }
}

export {};
