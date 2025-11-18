import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { 
  createProjectContainer, 
  stopContainer, 
  listContainers, 
  createFileInContainer, 
  runCommandInContainer,
  startContainer,
  removeContainer,
  listFilesInContainer,
  readFileInContainer,
  getContainerLogs,
} from './dockerManager';


autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

app.whenReady().then(() => {
  createWindow();
  // Добавлено автообновление
  autoUpdater.checkForUpdatesAndNotify();
});


let mainWindow: BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false, // Скрываем окно до полной загрузки
  });

  // В режиме разработки загружаем из собранного файла
  if (process.env.NODE_ENV === 'development') {
    // Ждем пока Vite соберет файлы
    setTimeout(() => {
      mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'));
    }, 2000);
  } else {
    // В production режиме загружаем собранный файл
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Показываем окно только после полной загрузки
  mainWindow.webContents.once('dom-ready', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Предотвращаем открытие новых окон
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
}

// Предотвращаем создание дополнительных окон
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

app.whenReady().then(() => {
  createWindow();

  autoUpdater.checkForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('create-project', async (_, projectName) => {
  try {
    console.log(`Получен запрос на создание проекта: ${projectName}`);
    const container = await createProjectContainer(projectName);
    console.log(`Проект ${projectName} успешно создан с containerId: ${container.id}`);
    return { success: true, containerId: container.id };
  } catch (error: any) {
    console.error('Ошибка при создании проекта:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

ipcMain.handle('stop-container', async (_, containerId) => {
  try {
    await stopContainer(containerId);
    return { success: true };
  } catch (error: any) {
    console.error('Error stopping container:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

ipcMain.handle('start-container', async (_, containerId) => {
  try {
    await startContainer(containerId);
    return { success: true };
  } catch (error: any) {
    console.error('Error starting container:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

ipcMain.handle('remove-container', async (_, containerId) => {
  try {
    await removeContainer(containerId);
    return { success: true };
  } catch (error: any) {
    console.error('Error removing container:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

ipcMain.handle('list-containers', async () => {
  try {
    const containers = await listContainers();
    return { success: true, containers };
  } catch (error: any) {
    console.error('Error listing containers:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

ipcMain.handle('create-file-in-container', async (_, containerId, filePath, content) => {
  try {
    await createFileInContainer(containerId, filePath, content);
    return { success: true };
  } catch (error: any) {
    console.error('Error creating file in container:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

ipcMain.handle('run-command-in-container', async (_, containerId, command) => {
  try {
    const result = await runCommandInContainer(containerId, command);
    return { success: true, result };
  } catch (error: any) {
    console.error('Error running command in container:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

ipcMain.handle('list-files-in-container', async (_, containerId) => {
  try {
    const files = await listFilesInContainer(containerId);
    return { success: true, files };
  } catch (error: any) {
    console.error('Error listing files in container:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

ipcMain.handle('read-file-in-container', async (_, containerId, filePath) => {
  try {
    const content = await readFileInContainer(containerId, filePath);
    return { success: true, content };
  } catch (error: any) {
    console.error('Error reading file in container:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

// Добавлено: IPC handler для получения логов контейнера
ipcMain.handle('get-container-logs', async (_, containerId) => {
  try {
    const logs = await getContainerLogs(containerId);
    return { success: true, logs };
  } catch (error: any) {
    console.error('Error getting container logs:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});


// IPC события для автообновления
autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-available', info);
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update-downloaded', info);
});

autoUpdater.on('download-progress', (progress) => {
  mainWindow?.webContents.send('update-progress', progress);
});

autoUpdater.on('error', (error) => {
  mainWindow?.webContents.send('update-error', error.message);
});

// IPC handler для установки обновления
ipcMain.handle('install-update', async () => {
  autoUpdater.quitAndInstall();
  return { success: true };
});