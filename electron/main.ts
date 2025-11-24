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
  getContainerPort,
  rebuildProject,
  setMainWindow
} from './dockerManager';


autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

// Решение проблем с GPU на Windows
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-gpu-rasterization');
  app.disableHardwareAcceleration();
}


let mainWindow: BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
    backgroundColor: '#ffffff',
  });

  // Отключение аппаратного ускорения для конкретного окна
  if (process.platform === 'win32') {
    mainWindow.setBackgroundColor('#ffffff');
  }

  setMainWindow(mainWindow);

  mainWindow.loadURL(
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../dist/index.html')}`
  );

 

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 🔥 Критически важно: при закрытии окна — завершать приложение
  mainWindow.on('close', (event) => {
    if (mainWindow) {
      event.preventDefault(); // Предотвращаем стандартное закрытие
      mainWindow.destroy();   // Уничтожаем окно
      mainWindow = null;
      app.quit(); // Завершаем приложение
    }
  });
  
}



app.on('ready', () => {
  autoUpdater.checkForUpdatesAndNotify();
  createWindow()
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Завершаем приложение при закрытии всех окон
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit(); // На macOS приложения обычно остаются активными
  }
});

// IPC handlers
ipcMain.handle('create-project', async (_, projectName) => {
  try {
    console.log(`Получен запрос на создание проекта: ${projectName}`);
    const { container, port } = await createProjectContainer(projectName);
    console.log(`Проект ${projectName} успешно создан с containerId: ${container.id}`);
    return { success: true, containerId: container.id, port };
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
    // Отправляем сообщение о начале выполнения команды
    mainWindow?.webContents.send('terminal-message', `[INFO] Executing command: ${command}`);
    
    const result = await runCommandInContainer(containerId, command);
    
    // Отправляем сообщение о завершении команды
    mainWindow?.webContents.send('terminal-message', `[INFO] Command completed`);
    
    return { success: true, result };
  } catch (error: any) {
    mainWindow?.webContents.send('terminal-message', `[ERROR] ${error.message || 'Unknown error'}`);
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

// Получение порта контейнера
ipcMain.handle('get-container-port', async (_, containerId) => {
  try {
    const port = await getContainerPort(containerId);
    return { success: true, port };
  } catch (error: any) {
    console.error('Error getting container port:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

// Новый IPC handler для пересборки проекта
ipcMain.handle('rebuild-project', async (_, containerId, port) => {
  try {
    await rebuildProject(containerId, port);
    // Отправляем сообщение о завершении команды
    mainWindow?.webContents.send('terminal-message', `[INFO] Rebuild completed`);
    return { success: true };
  } catch (error: any) {
    console.error('Error rebuilding project:', error);
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


// Добавляем новый IPC handler для отправки сообщений в терминал
ipcMain.handle('send-terminal-message', async (_, message: string) => {
  try {
    mainWindow?.webContents.send('terminal-message', message);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error' };
  }
});