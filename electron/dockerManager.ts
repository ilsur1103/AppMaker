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

    const container = await docker.createContainer({
      Image: 'node:18',
      name: containerName,
      Tty: true,
      WorkingDir: '/app',
      Cmd: ['bash'],
      ExposedPorts: { '3000/tcp': {} },
      HostConfig: {
        PortBindings: { '3000/tcp': [{ HostPort: '3000' }] }
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
    initializeProject(container.id).catch(error => {
      console.error('Ошибка при асинхронной инициализации проекта:', error);
    });
    
    return container;
  } catch (error) {
    console.error('Ошибка при создании контейнера:', error);
    throw error;
  }
}

export async function initializeProject(containerId: string) {
  try {
    console.log('Начало инициализации проекта...');
    
    // Создаем базовую структуру проекта локально
    const projectWorkDir = path.join(WORKDIR_BASE, containerId);
    
    // Создаем package.json
    const packageJson = JSON.stringify({
      "name": "ai-dev-project",
      "version": "1.0.0",
      "description": "",
      "main": "index.js",
      "scripts": {
        "start": "node server.js",
        "dev": "node server.js",
        "build": "echo Building..."
      },
      "dependencies": {
        "express": "^4.18.0"
      }
    }, null, 2);
    
    // Создаем server.js
    const serverJs = `
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('<h1>Hello from AI Dev Assistant!</h1><p>Your project is running successfully.</p>');
});

app.listen(port, '0.0.0.0', () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});
`;
    
    // Создаем файлы локально
    await createFileInWorkDir(containerId, 'package.json', packageJson);
    await createFileInWorkDir(containerId, 'server.js', serverJs);
    
    // Синхронизируем локальную директорию с контейнером
    await syncWorkDirToContainer(containerId);
    
    // Устанавливаем зависимости
    await runCommandInContainer(containerId, 'npm install');
    
    // Запускаем сервер
    await runCommandInContainer(containerId, 'npm run dev &');
    
    console.log('Проект инициализирован успешно');
  } catch (error) {
    console.error('Ошибка при инициализации проекта:', error);
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
    
    // Записываем файл
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
        const result = Buffer.concat(data).toString();
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
      Cmd: ['bash', '-c', 'find . -type f -o -type d | sed "s|^\\./||" | grep -v "^\\.$" | head -50'],
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
        const result = Buffer.concat(data).toString();
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
        const result = Buffer.concat(data).toString();
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
    
    return logs.toString();
  } catch (error) {
    console.error('Ошибка при получении логов контейнера:', error);
    throw error;
  }
}
