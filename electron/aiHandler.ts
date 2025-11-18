import axios from 'axios';

const OLLAMA_URL = 'http://localhost:11434/api/generate';

export async function sendToOllama(prompt: string) {
  try {
    const response = await axios.post(OLLAMA_URL, {
      model: 'qwen3-coder:30b',
      prompt: `You are an assistant that generates JSON responses with actions. Only respond in this format:
{
  "messageId": 0,
  "time": "...",
  "actions": [
    { "actionId": 0, "command": "CreateFile", "filename": "App.tsx", "path": "./", "content": "..." }
  ],
  "commands": ["npm install", "npm run build"]
}

User request: ${prompt}`,
      stream: false,
    });

    return response.data.response;
  } catch (error) {
    throw new Error(`Failed to communicate with Ollama: ${(error as Error).message}`);
  }
}
