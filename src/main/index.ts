import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'

import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { checkAllPrerequisites, installTool, getAwsProfiles } from './lib/system'

import { runInstaller, deployToAws } from './lib/installer'
import { AppConfig, DatabaseConfig } from '../shared/types'
import { listCockroachClusters, createCockroachCluster, getCockroachConnectionInfo } from './lib/cockroach'
// dynamic imports for postgres below

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 900,

    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.maximize()


  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.



app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })






  // IPC Handlers
  ipcMain.handle('check-prerequisites', async () => {
    return await checkAllPrerequisites()
  })

  ipcMain.handle('install-tool', async (_event, tool: string) => {
    return await installTool(tool)
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (canceled) {
      return null
    } else {
      return filePaths[0]
    }
  })

  ipcMain.handle('get-aws-profiles', async () => {
    return await getAwsProfiles()
  })

  ipcMain.handle('aws:saveCredentials', async (_event, accessKey: string, secretKey: string, region: string) => {
    const { saveAwsCredentials } = await import('./lib/system')
    return await saveAwsCredentials(accessKey, secretKey, region)
  })

  // CockroachDB Handlers
  ipcMain.handle('cockroach:listClusters', async (_event, apiKey: string) => {
    console.log('Main: IPC cockroach:listClusters received');
    return await listCockroachClusters(apiKey)
  })

  ipcMain.handle('cockroach:createCluster', async (_event, apiKey: string, name: string) => {
    console.log('Main: IPC cockroach:createCluster received', name);
    return await createCockroachCluster(apiKey, name)
  })

  ipcMain.handle('cockroach:getConnectionInfo', async (_event, apiKey: string, clusterId: string) => {
    console.log('Main: IPC cockroach:getConnectionInfo received', clusterId);
    return await getCockroachConnectionInfo(apiKey, clusterId)
  })

  ipcMain.handle('cockroach:listDatabases', async (_event, apiKey: string, clusterId: string) => {
    const { listCockroachDatabases } = await import('./lib/cockroach')
    return await listCockroachDatabases(apiKey, clusterId)
  })

  ipcMain.handle('cockroach:createDatabase', async (_event, apiKey: string, clusterId: string, name: string) => {
    const { createCockroachDatabase } = await import('./lib/cockroach')
    return await createCockroachDatabase(apiKey, clusterId, name)
  })

  ipcMain.handle('cockroach:listUsers', async (_event, apiKey: string, clusterId: string) => {
    const { listCockroachUsers } = await import('./lib/cockroach')
    return await listCockroachUsers(apiKey, clusterId)
  })

  ipcMain.handle('cockroach:createUser', async (_event, apiKey: string, clusterId: string, name: string, password?: string) => {
    const { createCockroachUser } = await import('./lib/cockroach')
    return await createCockroachUser(apiKey, clusterId, name, password)
  })

  ipcMain.handle('cockroach:getClusterStatus', async (_event, apiKey: string, clusterId: string) => {
    const { getClusterStatus } = await import('./lib/cockroach')
    return await getClusterStatus(apiKey, clusterId)
  })

  // PostgreSQL Handlers
  ipcMain.handle('postgres:testConnection', async (_event, config: DatabaseConfig) => {
    const { testPostgresConnection } = await import('./lib/postgres')
    return await testPostgresConnection(config)
  })

  ipcMain.handle('postgres:listDatabases', async (_event, config: DatabaseConfig) => {
    const { listPostgreSQLDatabases } = await import('./lib/postgres')
    return await listPostgreSQLDatabases(config)
  })

  ipcMain.handle('postgres:createDatabase', async (_event, config: DatabaseConfig, name: string) => {
    const { createPostgreSQLDatabase } = await import('./lib/postgres')
    return await createPostgreSQLDatabase(config, name)
  })

  ipcMain.handle('database:isEmpty', async (_event, config: DatabaseConfig) => {
    const { isDatabaseEmpty } = await import('./lib/postgres')
    return await isDatabaseEmpty(config)
  })

  ipcMain.handle('database:wipe', async (_event, config: DatabaseConfig) => {
    const { wipeDatabase } = await import('./lib/postgres')
    return await wipeDatabase(config)
  })

  ipcMain.on('start-install', (event, config: AppConfig) => {
    // We don't await this because we want to return immediately and send logs via events
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      runInstaller(config, win)
    }
  })

  ipcMain.on('start-deploy', (event, config: AppConfig) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      deployToAws(config, win)
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})


// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
