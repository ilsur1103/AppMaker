/// <reference types="vite/client" />

// Определяем типы для Electron API в глобальном объекте window
interface Window {
  electron: {
    getContainerLogs: (containerId: string) => Promise<{ success: boolean; logs?: string; containerId?: string; error?: string }>;
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
    getContainerPort: (containerId: string) => Promise<{ success: boolean; port?: number; error?: string }>;
    rebuildProject: (containerId: string, port: number) => Promise<{ success: boolean; error?: string }>;

    onUpdateAvailable: (callback: (info: any) => void) => void;
    onUpdateDownloaded: (callback: (info: any) => void) => void;
    onUpdateProgress: (callback: (progress: any) => void) => void;
    onUpdateError: (callback: (error: string) => void) => void;
    installUpdate: () => Promise<{ success: boolean }>;
  };
}
