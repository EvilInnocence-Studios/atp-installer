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



app.whenReady().then(async () => {
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

  ipcMain.handle('aws:getAccountId', async (_event, profile: string) => {
    const { getAwsAccountId } = await import('./lib/system')
    return await getAwsAccountId(profile)
  })


  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    console.log('Main: openExternal called with:', url)
    if (!url || !url.startsWith('http')) {
        console.warn('Main: Invalid URL for openExternal:', url)
        return
    }
    await shell.openExternal(url)
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

  ipcMain.handle('database:isInitialized', async (_event, config: DatabaseConfig) => {
    const { isDatabaseInitialized } = await import('./lib/postgres')
    return await isDatabaseInitialized(config)
  })

  ipcMain.handle('database:isEmpty', async (_event, config: DatabaseConfig) => {
    const { isDatabaseEmpty } = await import('./lib/postgres')
    return await isDatabaseEmpty(config)
  })

  ipcMain.handle('database:wipe', async (_event, config: DatabaseConfig) => {
    const { wipeDatabase } = await import('./lib/postgres')
    return await wipeDatabase(config)
  })

  ipcMain.handle('load-project-config', async (_event, path: string) => {
    const { loadProjectConfig } = await import('./lib/installer')
    return await loadProjectConfig(path)
  })

  ipcMain.on('start-install', (event, config: AppConfig) => {
    // We don't await this because we want to return immediately and send logs via events
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      runInstaller(config, win)
    }
  })

  ipcMain.on('start-deploy', (event, config: AppConfig, target?: 'api' | 'admin' | 'public' | 'all') => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      deployToAws(config, win, target)
    }
  })

  ipcMain.on('start-check-aws-status', async (event, config: AppConfig) => {
    const { checkAwsStatus } = await import('./lib/installer')
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      checkAwsStatus(config, win)
    }
  })

  ipcMain.on('update-project-modules', async (event, config: AppConfig, newModules: string[]) => {
    const { updateProjectModules } = await import('./lib/installer')
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      updateProjectModules(config, newModules, win)
    }
  })

  // Migrations
  ipcMain.handle('run-migration-sync', async (event, config: AppConfig, env: 'local' | 'prod') => {
    const { runMigrationSync } = await import('./lib/installer')
    const win = BrowserWindow.fromWebContents(event.sender)
    return await runMigrationSync(config, win!, env)
  })

  ipcMain.handle('run-db-setup', async (event, config: AppConfig, env: 'local' | 'prod') => {
    const { runDbSetup } = await import('./lib/installer')
    const win = BrowserWindow.fromWebContents(event.sender)
    return await runDbSetup(config, win!, env)
  })

  ipcMain.handle('migration:getStatus', async (_event, config: AppConfig, env: 'local' | 'prod') => {
    const { getMigrationStatus } = await import('./lib/installer')
    return await getMigrationStatus(config, env)
  })

  ipcMain.handle('migration:runSync', async (event, config: AppConfig, env: 'local' | 'prod') => {
    const { runMigrationSync } = await import('./lib/installer')
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      return await runMigrationSync(config, win, env)
    }
    return false
  })

  // AWS Resource Init
  ipcMain.handle('aws:ensureS3Bucket', async (_event, bucketName: string, options: any) => {
    const { ensureS3Bucket } = await import('./lib/aws-init')
    return await ensureS3Bucket(bucketName, options)
  })

  ipcMain.handle('aws:ensureLambdaRole', async (_event, roleName: string, options: any) => {
    const { ensureLambdaRole } = await import('./lib/aws-init')
    return await ensureLambdaRole(roleName, options)
  })

  ipcMain.handle('aws:ensureCertificate', async (_event, domainName: string, options: any) => {
    const { ensureCertificate } = await import('./lib/aws-init')
    return await ensureCertificate(domainName, options)
  })

  ipcMain.handle('aws:ensureCloudFrontDistribution', async (_event, apiPath: string, env: any) => {
    const { ensureCloudFrontDistribution } = await import('./lib/aws-init')
    return await ensureCloudFrontDistribution(apiPath, env)
  })

  // Dev Controls
  const { processManager } = await import('./lib/processes')
  
  ipcMain.handle('dev:startAll', async (event, config: AppConfig) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) processManager.setWindow(win)
    
    const apiPath = join(config.destination, config.projectName, 'api')
    const adminPath = join(config.destination, config.projectName, 'admin')
    const publicPath = join(config.destination, config.projectName, 'public')

    await Promise.all([
        processManager.start('api', apiPath),
        processManager.start('admin', adminPath),
        processManager.start('public', publicPath)
    ])
    return true
  })

  ipcMain.handle('dev:restart', async (event, config: AppConfig, target: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) processManager.setWindow(win)
    
    const targetPath = join(config.destination, config.projectName, target)
    await processManager.restart(target, targetPath)
    return true
  })

  ipcMain.handle('dev:stop', async (_event, target: string) => {
    await processManager.stop(target)
    return true
  })

  ipcMain.handle('dev:getStatus', async () => {
    return processManager.getStatus()
  })

  app.on('before-quit', () => {
    processManager.stopAll()
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
