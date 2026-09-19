const { contextBridge, ipcRenderer } = require('electron')

function subscribe(channel, callback) {
  const listener = (_event, value) => callback(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('flowcastDesktop', {
  openOutput: () => ipcRenderer.invoke('output:open'),
  getFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  setFullscreen: (value) => ipcRenderer.invoke('window:set-fullscreen', value),
  onFullscreen: (callback) => subscribe('window:fullscreen-changed', callback),
  connectVoice: () => ipcRenderer.invoke('voice:connect'),
  onVoiceStatus: (callback) => subscribe('voice:status', callback),
  onAccountChanged: (callback) => subscribe('account:changed', callback),
})
