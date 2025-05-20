// ===== src/preload.js =====
// Este archivo conecta la interfaz web con las funciones nativas de Electron

const { contextBridge, ipcRenderer } = require('electron');

// Exponer funciones seguras a la aplicación web
contextBridge.exposeInMainWorld('electronAPI', {
  setSavePath: (path) => ipcRenderer.invoke('set-save-path', path),
  getSavePath: () => ipcRenderer.invoke('get-save-path'),
  saveImage: (imageData) => ipcRenderer.invoke('save-image', imageData),
  getNextImageNumber: () => ipcRenderer.invoke('get-next-image-number')
});