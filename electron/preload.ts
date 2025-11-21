import { contextBridge, ipcRenderer } from 'electron';

// Определяем типы для нашего API
interface ElectronAPI {
  createProject: (projectName: string) => Promise<{ success: boolean; containerId?: string; port?: number; error?: string }>;
  stopContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
  startContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
  removeContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
  listContainers: () => Promise<{ success: boolean; containers?: any[]; error?: string }>;
  sendToOllama: (prompt: string) => Promise<any>;
  createFileInContainer: (containerId: string, filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  runCommandInContainer: (containerId: string, command: string) => Promise<{ success: boolean; result?: string; error?: string }>;
  listFilesInContainer: (containerId: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
  readFileInContainer: (containerId: string, filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  getContainerLogs: (containerId: string) => Promise<{ success: boolean; logs?: string; error?: string }>;
  getContainerPort: (containerId: string) => Promise<{ success: boolean; port?: number; error?: string }>;

  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  onUpdateProgress: (callback: (progress: any) => void) => void;
  onUpdateError: (callback: (error: string) => void) => void;
  installUpdate: () => Promise<{ success: boolean }>;
}

// Создаем безопасный API для фронтенда
const electronAPI: ElectronAPI = {
  createProject: (projectName: string) => ipcRenderer.invoke('create-project', projectName),
  stopContainer: (containerId: string) => ipcRenderer.invoke('stop-container', containerId),
  startContainer: (containerId: string) => ipcRenderer.invoke('start-container', containerId),
  removeContainer: (containerId: string) => ipcRenderer.invoke('remove-container', containerId),
  listContainers: () => ipcRenderer.invoke('list-containers'),
  sendToOllama: (prompt: string) => ipcRenderer.invoke('send-to-ollama', prompt),
  createFileInContainer: (containerId: string, filePath: string, content: string) => 
    ipcRenderer.invoke('create-file-in-container', containerId, filePath, content),
  runCommandInContainer: (containerId: string, command: string) => 
    ipcRenderer.invoke('run-command-in-container', containerId, command),
  listFilesInContainer: (containerId: string) => 
    ipcRenderer.invoke('list-files-in-container', containerId),
  readFileInContainer: (containerId: string, filePath: string) => 
    ipcRenderer.invoke('read-file-in-container', containerId, filePath),
  getContainerLogs: (containerId: string) => 
    ipcRenderer.invoke('get-container-logs', containerId),
  getContainerPort: (containerId: string) => 
    ipcRenderer.invoke('get-container-port', containerId),

  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_, info) => callback(info)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_, progress) => callback(progress)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_, error) => callback(error)),
  installUpdate: () => ipcRenderer.invoke('install-update')
};

// Экспортируем API в глобальный объект window
contextBridge.exposeInMainWorld('electron', electronAPI);
