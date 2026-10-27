const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAlerts: () => ipcRenderer.invoke('get-alerts'),
  onAlertsUpdated: (callback) => ipcRenderer.on('alerts-updated', (_event, value) => callback(value)),
  refreshNow: () => ipcRenderer.invoke('refresh-now'),
  triggerSso: () => ipcRenderer.send('trigger-sso'),
  triggerKarmaSso: () => ipcRenderer.send('trigger-karma-sso'),
  openExternal: (url) => ipcRenderer.send('open-external-url', url),
  openSsh: (host) => ipcRenderer.send('open-ssh', host),
  showContextMenu: (data) => ipcRenderer.send('show-context-menu', data),
  toggleLocalDone: (key, note) => ipcRenderer.invoke('toggle-local-done', { key, note }),
  bulkLocalDone: (keys, note) => ipcRenderer.invoke('bulk-local-done', { keys, note }),
  bulkLocalUndone: (keys) => ipcRenderer.invoke('bulk-local-undone', { keys }),
  clearAllDone: () => ipcRenderer.invoke('clear-all-done'),
  importHandover: (text) => ipcRenderer.invoke('import-handover', text),
  recheckService: (id, host, service) => ipcRenderer.invoke('icinga-recheck', { id, host, service }),
  ackService: (id, host, service, comment, persistent) => ipcRenderer.invoke('icinga-ack', { id, host, service, comment, persistent }),
  removeAckService: (id, host, service) => ipcRenderer.invoke('icinga-remove-ack', { id, host, service }),
  downtimeService: (id, host, service, minutes, comment, startStr, endStr) => 
    ipcRenderer.invoke('icinga-downtime', { id, host, service, minutes, comment, startStr, endStr }),
  removeDowntimeService: (id, host, service, dtName, dtId) => 
    ipcRenderer.invoke('icinga-remove-downtime', { id, host, service, dtName, dtId })
});
