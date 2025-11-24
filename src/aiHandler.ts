import axios from 'axios';

const OLLAMA_URL = 'http://localhost:11434/api/generate';

export interface AIAction {
  actionId?: number;
  command: string;
  filename?: string;
  path?: string;
  content?: string;
  sourcePath?: string;
  targetPath?: string;
}

export interface AIResponse {
  messageId: number;
  time: string;
  actions: AIAction[];
  commands: string[];
}

export async function sendToOllama(prompt: string): Promise<AIResponse> {
  try {
    const response = await axios.post(OLLAMA_URL, {
      model: 'qwen3-coder:480b-cloud',
      prompt: `You are an assistant that generates JSON responses with actions. Only respond in this format:
{
  "messageId": 0,
  "time": "...",
  "actions": [
    { "actionId": 0, "command": "CreateFile", "filename": "App.tsx", "path": "./", "content": "..." }
  ],
  "commands": ["npm install", "npm run build"]
}

Rules: in vite.config.ts server port should be always 3000

Available commands:
- CreateFile: Create a new file with content
- DeleteFile: Delete a file
- MoveFile: Move/rename a file
- CreateDirectory: Create a directory
- UpdateFile: Update existing file content or create new file if it doesn't exist

Your general goal make instructions with command for create workable react application with use typescript and vite. 

User request: ${prompt}`,
      stream: false,
    });

    return JSON.parse(response.data.response);
  } catch (error) {
    throw new Error(`Failed to communicate with Ollama: ${(error as Error).message}`);
  }
}

export async function processAIActions(containerId: string, actions: AIAction[]) {
  for (const action of actions) {
    switch (action.command) {
      case 'CreateFile':
        if (action.filename && action.content !== undefined) {
          await window.electron.createFileInContainer(
            containerId,
            action.path ? `${action.path}/${action.filename}` : action.filename,
            action.content
          );
        }
        break;
      case 'UpdateFile':
        if (action.filename && action.content !== undefined) {
          // UpdateFile создает файл если его нет, или обновляет если есть
          await window.electron.createFileInContainer(
            containerId,
            action.path ? `${action.path}/${action.filename}` : action.filename,
            action.content
          );
        }
        break;
      case 'DeleteFile':
        if (action.filename) {
          await window.electron.runCommandInContainer(
            containerId,
            `rm -f "${action.filename}"`
          );
        }
        break;
      case 'MoveFile':
        if (action.sourcePath && action.targetPath) {
          await window.electron.runCommandInContainer(
            containerId,
            `mv "${action.sourcePath}" "${action.targetPath}"`
          );
        }
        break;
      case 'CreateDirectory':
        if (action.path) {
          await window.electron.runCommandInContainer(
            containerId,
            `mkdir -p "${action.path}"`
          );
        }
        break;
    }
  }
}
