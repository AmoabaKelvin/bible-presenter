export {}

declare global {
  interface Window {
    flowcastDesktop?: {
      openOutput: () => Promise<void>
      getFullscreen: () => Promise<boolean>
      setFullscreen: (value: boolean) => Promise<boolean>
      onFullscreen: (callback: (value: boolean) => void) => () => void
      connectVoice: () => Promise<{ url: string; token: string }>
      onVoiceStatus: (callback: (message: string) => void) => () => void
      onAccountChanged: (callback: () => void) => () => void
    }
  }
}
