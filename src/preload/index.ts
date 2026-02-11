import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  checkPrerequisites: () => ipcRenderer.invoke('check-prerequisites'),
  installTool: (tool: string) => ipcRenderer.invoke('install-tool', tool),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  getAwsProfiles: () => ipcRenderer.invoke('get-aws-profiles'),
  saveAwsCredentials: (accessKey: string, secretKey: string, region: string) => ipcRenderer.invoke('aws:saveCredentials', accessKey, secretKey, region),
  startInstall: (config: any) => ipcRenderer.send('start-install', config),



  startDeploy: (config: any) => ipcRenderer.send('start-deploy', config),
  onLog: (callback: (log: any) => void) => {
    const subscription = (_event: any, value: any) => callback(value)
    ipcRenderer.on('install-log', subscription)
    return () => ipcRenderer.removeListener('install-log', subscription)
  },
  onComplete: (callback: (success: boolean) => void) => {
    const subscription = (_event: any, value: any) => callback(value)
    ipcRenderer.on('install-complete', subscription)
    return () => ipcRenderer.removeListener('install-complete', subscription)
  },
  onDeployComplete: (callback: (success: boolean) => void) => {
    const subscription = (_event: any, value: any) => callback(value)
    ipcRenderer.on('deploy-complete', subscription)
    return () => ipcRenderer.removeListener('deploy-complete', subscription)
  },

  // CockroachDB
  listClusters: (apiKey: string) => ipcRenderer.invoke('cockroach:listClusters', apiKey),
  createCluster: (apiKey: string, name: string) => ipcRenderer.invoke('cockroach:createCluster', apiKey, name),
  getClusterStatus: (apiKey: string, clusterId: string) => ipcRenderer.invoke('cockroach:getClusterStatus', apiKey, clusterId),
  getConnectionInfo: (apiKey: string, clusterId: string) => ipcRenderer.invoke('cockroach:getConnectionInfo', apiKey, clusterId),
  listCockroachDatabases: (apiKey: string, clusterId: string) => ipcRenderer.invoke('cockroach:listDatabases', apiKey, clusterId),
  createCockroachDatabase: (apiKey: string, clusterId: string, name: string) => ipcRenderer.invoke('cockroach:createDatabase', apiKey, clusterId, name),
  listUsers: (apiKey: string, clusterId: string) => ipcRenderer.invoke('cockroach:listUsers', apiKey, clusterId),
  createUser: (apiKey: string, clusterId: string, name: string, password?: string) => ipcRenderer.invoke('cockroach:createUser', apiKey, clusterId, name, password),
  // PostgreSQL
  testPostgresConnection: (config: any) => ipcRenderer.invoke('postgres:testConnection', config),
  listPostgresDatabases: (config: any) => ipcRenderer.invoke('postgres:listDatabases', config),
  createPostgresDatabase: (config: any, name: string) => ipcRenderer.invoke('postgres:createDatabase', config, name),
  isDatabaseEmpty: (config: any) => ipcRenderer.invoke('database:isEmpty', config),
  wipeDatabase: (config: any) => ipcRenderer.invoke('database:wipe', config)

}


// ... existing code ...
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

