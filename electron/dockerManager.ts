// dockerManager.ts
import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import archiver from 'archiver';

const docker = new Docker();
const WORKDIR_BASE = path.join(process.cwd(), 'workdirs');

// Создаем базовую директорию для рабочих папок если её нет
if (!fs.existsSync(WORKDIR_BASE)) {
  fs.mkdirSync(WORKDIR_BASE, { recursive: true });
}

// Функция для поиска свободного порта
async function findFreePort(): Promise<number> {
  const server = require('net').createServer();
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const port = (server.address() as any).port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

export async function createProjectContainer(projectName: string) {
  try {
    console.log('Проверка наличия образа node:18...');
    
    // Проверяем, существует ли образ node:18
    let imageExists = false;
    try {
      await docker.getImage('node:18').inspect();
      console.log('Образ node:18 найден локально');
      imageExists = true;
    } catch (error) {
      console.log('Образ node:18 не найден локально');
      imageExists = false;
    }

    // Если образ не найден, загружаем его
    if (!imageExists) {
      console.log('Начинаем загрузку образа node:18...');
      try {
        await pullImage('node:18');
        console.log('Образ node:18 успешно загружен');
      } catch (pullError) {
        console.error('Ошибка при загрузке образа node:18:', pullError);
        // Пробуем использовать node:latest как fallback
        try {
          console.log('Пробуем загрузить образ node:latest...');
          await pullImage('node:latest');
          console.log('Образ node:latest успешно загружен');
        } catch (fallbackError) {
          console.error('Ошибка при загрузке fallback образа:', fallbackError);
          throw new Error('Не удалось загрузить ни node:18, ни node:latest образы');
        }
      }
    }

    const containerName = `ai-dev-${projectName}-${Date.now()}`;
    console.log(`Создание контейнера с именем: ${containerName}`);

    // Проверяем и удаляем существующий контейнер с таким именем
    try {
      const containers = await docker.listContainers({ all: true });
      const existingContainer = containers.find(container => 
        container.Names.some(name => name === `/${containerName}`)
      );
      
      if (existingContainer) {
        const container = docker.getContainer(existingContainer.Id);
        const info = await container.inspect();
        if (info.State.Running) {
          await container.stop({ t: 10 });
        }
        await container.remove();
        console.log(`Удален существующий контейнер с именем: ${containerName}`);
      }
    } catch (error) {
      console.log('Нет существующего контейнера для удаления или ошибка при проверке');
    }

    // Генерируем свободный порт
    const port = await findFreePort();
    console.log(`Используем порт: ${port}`);

    const container = await docker.createContainer({
      Image: 'node:18',
      name: containerName,
      Tty: true,
      WorkingDir: '/app',
      Cmd: ['bash'],
      ExposedPorts: { [`${port}/tcp`]: {} },
      HostConfig: {
        PortBindings: { [`${port}/tcp`]: [{ HostPort: `${port}` }] }
      }
    });

    console.log('Контейнер создан, запуск...');
    await container.start();
    console.log('Контейнер успешно запущен');
    
    // Создаем локальную рабочую директорию для проекта
    const projectWorkDir = path.join(WORKDIR_BASE, container.id);
    if (!fs.existsSync(projectWorkDir)) {
      fs.mkdirSync(projectWorkDir, { recursive: true });
    }
    
    // Инициализируем базовый проект (асинхронно, без ожидания)
    initializeProject(container.id, port).catch(error => {
      console.error('Ошибка при асинхронной инициализации проекта:', error);
    });
    
    return { container, port };
  } catch (error) {
    console.error('Ошибка при создании контейнера:', error);
    throw error;
  }
}

export async function initializeProject(containerId: string, port: number) {
  try {
    console.log('Начало инициализации проекта...');
    
    // Создаем базовую структуру React проекта локально
    const projectWorkDir = path.join(WORKDIR_BASE, containerId);
    
    // Создаем package.json
    const packageJson = JSON.stringify({
      "name": "ai-dev-react-project",
      "version": "1.0.0",
      "description": "",
      "main": "index.js",
      "scripts": {
        "dev": "vite",
        "build": "tsc && vite build",
        "preview": "vite preview"
      },
      "dependencies": {
        "react": "^18.2.0",
        "react-dom": "^18.2.0"
      },
      "devDependencies": {
        "@types/react": "^18.2.15",
        "@types/react-dom": "^18.2.7",
        "@vitejs/plugin-react": "^4.0.3",
        "typescript": "^5.0.2",
        "vite": "^4.4.5"
      }
    }, null, 2);
    
    // Создаем tsconfig.json
    const tsconfigJson = JSON.stringify({
      "compilerOptions": {
        "target": "ES2020",
        "useDefineForClassFields": true,
        "lib": ["ES2020", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "skipLibCheck": true,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx",
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true
      },
      "include": ["src"],
      "references": [{ "path": "./tsconfig.node.json" }]
    }, null, 2);
    
    // Создаем tsconfig.node.json
    const tsconfigNodeJson = JSON.stringify({
      "compilerOptions": {
        "composite": true,
        "skipLibCheck": true,
        "module": "ESNext",
        "moduleResolution": "bundler"
      },
      "include": ["vite.config.ts"]
    }, null, 2);
    
    // Создаем vite.config.ts
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: ${port}
  }
})`;
    
    // Создаем src директорию
    const srcDir = path.join(projectWorkDir, 'src');
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }
    
    // Создаем src/App.tsx
    const appTsx = `import React from 'react'
import './App.css'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Hello from AI Dev Assistant!</h1>
        <p>Your React app is running successfully.</p>
      </header>
    </div>
  )
}

export default App`;
    
    // Создаем src/main.tsx
    const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;
    
    // Создаем src/App.css
    const appCss = `.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.App-header h1 {
  margin: 0;
  font-size: 2rem;
}

.App-header p {
  font-size: 1.2rem;
  margin-top: 10px;
}`;
    
    // Создаем src/index.css
    const indexCss = `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}`;
    
    // Создаем index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Dev Assistant</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

    // Создаем файлы локально
    await createFileInWorkDir(containerId, 'package.json', packageJson);
    await createFileInWorkDir(containerId, 'tsconfig.json', tsconfigJson);
    await createFileInWorkDir(containerId, 'tsconfig.node.json', tsconfigNodeJson);
    await createFileInWorkDir(containerId, 'vite.config.ts', viteConfig);
    await createFileInWorkDir(containerId, 'index.html', indexHtml);
    await createFileInWorkDir(containerId, 'src/App.tsx', appTsx);
    await createFileInWorkDir(containerId, 'src/main.tsx', mainTsx);
    await createFileInWorkDir(containerId, 'src/App.css', appCss);
    await createFileInWorkDir(containerId, 'src/index.css', indexCss);
    
    // Синхронизируем локальную директорию с контейнером
    await syncWorkDirToContainer(containerId);
    
    // Устанавливаем зависимости и запускаем Vite
    await rebuildProject(containerId, port);
    
    console.log('React проект инициализирован успешно');
  } catch (error) {
    console.error('Ошибка при инициализации проекта:', error);
  }
}

// Новая функция для пересборки проекта
export async function rebuildProject(containerId: string, port: number) {
  try {
    console.log(`Пересборка проекта в контейнере ${containerId}`);
    
    // Останавливаем предыдущий процесс Vite если он есть
    await runCommandInContainer(containerId, 'pkill -f "vite" || true');
    
    // Синхронизируем локальную директорию с контейнером
    await syncWorkDirToContainer(containerId);
    
    // Устанавливаем зависимости
    console.log('Установка зависимостей...');
    await runCommandInContainer(containerId, 'npm install');
    
    // Запускаем Vite сервер в фоновом режиме
    console.log('Запуск Vite сервера...');
    await runCommandInContainer(containerId, 'npm run dev &');
    
    console.log('Проект успешно пересобран');
  } catch (error) {
    console.error('Ошибка при пересборке проекта:', error);
    throw error;
  }
}

export async function pullImage(imageName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Начинаем загрузку образа: ${imageName}`);
    
    docker.pull(imageName, (err: any, stream: any) => {
      if (err) {
        console.error(`Ошибка при загрузке образа ${imageName}:`, err);
        reject(err);
        return;
      }

      docker.modem.followProgress(stream, (err: any, res: any) => {
        if (err) {
          console.error(`Ошибка при обработке прогресса загрузки ${imageName}:`, err);
          reject(err);
        } else {
          console.log(`Загрузка образа ${imageName} завершена:`, res);
          resolve();
        }
      }, (event: any) => {
        if (event.status) {
          console.log(`${imageName}: ${event.status} ${event.progress || ''}`);
        }
      });
    });
  });
}

export async function stopContainer(containerId: string) {
  try {
    const container = docker.getContainer(containerId);
    
    // Получаем информацию о состоянии контейнера
    const info = await container.inspect();
    
    // Проверяем, запущен ли контейнер
    if (info.State.Running) {
      console.log(`Остановка контейнера ${containerId}`);
      await container.stop({ t: 10 });
    } else {
      console.log(`Контейнер ${containerId} уже остановлен`);
    }
  } catch (error) {
    console.error('Ошибка при остановке контейнера:', error);
    throw error;
  }
}

export async function startContainer(containerId: string) {
  try {
    const container = docker.getContainer(containerId);
    
    // Получаем информацию о состоянии контейнера
    const info = await container.inspect();
    
    // Проверяем, остановлен ли контейнер
    if (!info.State.Running) {
      console.log(`Запуск контейнера ${containerId}`);
      await container.start();
    } else {
      console.log(`Контейнер ${containerId} уже запущен`);
    }
  } catch (error) {
    console.error('Ошибка при запуске контейнера:', error);
    throw error;
  }
}

export async function removeContainer(containerId: string) {
  try {
    const container = docker.getContainer(containerId);
    
    // Получаем информацию о состоянии контейнера
    const info = await container.inspect();
    
    // Останавливаем контейнер, если он запущен
    if (info.State.Running) {
      console.log(`Остановка контейнера ${containerId} перед удалением`);
      await container.stop({ t: 10 });
    }
    
    // Удаляем контейнер
    console.log(`Удаление контейнера ${containerId}`);
    await container.remove();
    console.log(`Контейнер ${containerId} успешно удален`);
    
    // Удаляем локальную рабочую директорию
    const projectWorkDir = path.join(WORKDIR_BASE, containerId);
    if (fs.existsSync(projectWorkDir)) {
      fs.rmSync(projectWorkDir, { recursive: true, force: true });
      console.log(`Локальная директория ${projectWorkDir} успешно удалена`);
    }
  } catch (error: any) {
    console.error('Ошибка при удалении контейнера:', error);
    
    // Если контейнер уже остановлен или другая ошибка, пробуем удалить напрямую
    try {
      const container = docker.getContainer(containerId);
      await container.remove({ force: true });
      console.log(`Контейнер ${containerId} успешно удален (принудительно)`);
      
      // Удаляем локальную рабочую директорию
      const projectWorkDir = path.join(WORKDIR_BASE, containerId);
      if (fs.existsSync(projectWorkDir)) {
        fs.rmSync(projectWorkDir, { recursive: true, force: true });
        console.log(`Локальная директория ${projectWorkDir} успешно удалена`);
      }
    } catch (forceError) {
      console.error('Ошибка при принудительном удалении контейнера:', forceError);
      throw forceError;
    }
  }
}

export async function listContainers() {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { name: ['ai-dev-'] }
    });
    return containers;
  } catch (error) {
    console.error('Ошибка при получении списка контейнеров:', error);
    throw error;
  }
}

// Новый метод для создания файлов в локальной рабочей директории
export async function createFileInWorkDir(containerId: string, filePath: string, content: string) {
  try {
    const projectWorkDir = path.join(WORKDIR_BASE, containerId);
    const fullFilePath = path.join(projectWorkDir, filePath);
    
    // Создаем директории если нужно
    const dirPath = path.dirname(fullFilePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Записываем файл с правильной кодировкой
    fs.writeFileSync(fullFilePath, content, 'utf8');
    console.log(`Файл ${filePath} успешно создан в локальной директории`);
    
  } catch (error) {
    console.error(`Ошибка при создании файла ${filePath} в локальной директории:`, error);
    throw error;
  }
}

// Обновленный метод syncWorkDirToContainer
export async function syncWorkDirToContainer(containerId: string) {
  const container = docker.getContainer(containerId);
  const projectWorkDir = path.join(WORKDIR_BASE, containerId);
  
  try {
    if (!fs.existsSync(projectWorkDir)) {
      throw new Error(`Локальная директория проекта не найдена: ${projectWorkDir}`);
    }
    
    // Создаем архив из локальной директории
    const archivePath = path.join(WORKDIR_BASE, `${containerId}_sync.tar`);
    
    return new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('tar', {
        zlib: { level: 9 } // Максимальное сжатие
      });
      
      output.on('close', async () => {
        try {
          // Читаем архив и копируем в контейнер
          const archiveStream = fs.createReadStream(archivePath);
          
          // putArchive автоматически разархивирует tar-архив в контейнере
          await container.putArchive(archiveStream, { path: '/app' });
          
          // Удаляем временный архив после успешной передачи
          fs.unlinkSync(archivePath);
          
          console.log('Локальная директория успешно синхронизирована с контейнером');
          resolve();
        } catch (error) {
          // Удаляем временный архив в случае ошибки
          if (fs.existsSync(archivePath)) {
            try {
              fs.unlinkSync(archivePath);
            } catch (unlinkError) {
              console.error('Ошибка при удалении временного архива:', unlinkError);
            }
          }
          console.error('Ошибка при копировании архива в контейнер:', error);
          reject(error);
        }
      });
      
      archive.on('error', (err) => {
        console.error('Ошибка при создании архива:', err);
        // Удаляем временный архив в случае ошибки создания
        if (fs.existsSync(archivePath)) {
          try {
            fs.unlinkSync(archivePath);
          } catch (unlinkError) {
            console.error('Ошибка при удалении временного архива:', unlinkError);
          }
        }
        reject(err);
      });
      
      archive.pipe(output);
      
      // Добавляем все файлы из рабочей директории
      archive.directory(projectWorkDir, false);
      
      archive.finalize();
    });
    
  } catch (error) {
    console.error('Ошибка при синхронизации локальной директории с контейнером:', error);
    throw error;
  }
}

// Обновленный метод для создания файлов (использует локальную директорию)
export async function createFileInContainer(containerId: string, filePath: string, content: string) {
  try {
    // Создаем файл в локальной директории
    await createFileInWorkDir(containerId, filePath, content);
    
    // Синхронизируем локальную директорию с контейнером
    await syncWorkDirToContainer(containerId);
    
    console.log(`Файл ${filePath} успешно создан и синхронизирован с контейнером`);
  } catch (error) {
    console.error(`Ошибка при создании файла ${filePath} в контейнере:`, error);
    throw error;
  }
}

export async function runCommandInContainer(containerId: string, command: string) {
  const container = docker.getContainer(containerId);
  
  try {
    console.log(`Выполнение команды в контейнере: ${command}`);
    
    const exec = await container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/app'
    });
    
    const stream = await exec.start({});
    const data: Buffer[] = [];
    
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout while running command in container'));
      }, 30000);
      
      stream.on('data', (chunk) => {
        data.push(chunk);
      });
      
      stream.on('end', () => {
        clearTimeout(timeout);
        const result = Buffer.concat(data).toString('utf8');
        console.log(`Результат выполнения команды: ${result}`);
        resolve(result);
      });
      
      stream.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`Ошибка выполнения команды ${command}:`, error);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Ошибка при выполнении команды ${command}:`, error);
    throw error;
  }
}

export async function listFilesInContainer(containerId: string) {
  const container = docker.getContainer(containerId);
  
  try {
    const exec = await container.exec({
      Cmd: ['bash', '-c', 'find . -type f -o -type d | sed "s|^\\./||" | grep -v "^\\.$"'],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/app'
    });
    
    const stream = await exec.start({});
    const data: Buffer[] = [];
    
    return new Promise<string[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout while listing files in container'));
      }, 10000);
      
      stream.on('data', (chunk) => {
        data.push(chunk);
      });
      
      stream.on('end', () => {
        clearTimeout(timeout);
        const result = Buffer.concat(data).toString('utf8');
        const files = result.trim().split('\n').filter(Boolean);
        resolve(files);
      });
      
      stream.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Ошибка при получении списка файлов:', error);
    throw error;
  }
}

export async function readFileInContainer(containerId: string, filePath: string) {
  const container = docker.getContainer(containerId);
  
  try {
    const exec = await container.exec({
      Cmd: ['bash', '-c', `cat "${filePath}" 2>/dev/null || echo "File not found or cannot be read"`],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/app'
    });
    
    const stream = await exec.start({});
    const data: Buffer[] = [];
    
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout while reading file in container'));
      }, 10000);
      
      stream.on('data', (chunk) => {
        data.push(chunk);
      });
      
      stream.on('end', () => {
        clearTimeout(timeout);
        const result = Buffer.concat(data).toString('utf8');
        resolve(result);
      });
      
      stream.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Ошибка при чтении файла ${filePath}:`, error);
    throw error;
  }
}

// Функция для получения логов контейнера
export async function getContainerLogs(containerId: string, tail: number = 50) {
  const container = docker.getContainer(containerId);
  
  try {
    const logs = await container.logs({
      follow: false,
      stdout: true,
      stderr: true,
      tail: tail
    });
    
    return logs.toString('utf8');
  } catch (error) {
    console.error('Ошибка при получении логов контейнера:', error);
    throw error;
  }
}

// Получение порта контейнера
export async function getContainerPort(containerId: string): Promise<number> {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    const portBindings = info.NetworkSettings.Ports;
    
    // Ищем первый доступный порт
    for (const port in portBindings) {
      if (portBindings[port] && portBindings[port].length > 0) {
        return parseInt(portBindings[port][0].HostPort, 10);
      }
    }
    
    return 3000; // значение по умолчанию
  } catch (error) {
    console.error('Ошибка при получении порта контейнера:', error);
    return 3000;
  }
}
