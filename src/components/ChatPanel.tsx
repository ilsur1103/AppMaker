import React, { useState, useRef, useEffect } from 'react';
import { sendToOllama, AIResponse } from '../aiHandler';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: Date;
}

interface ChatPanelProps {
  containerId: string;
  port: number;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ containerId, port }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I'm your AI development assistant. How can I help you today?",
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    // Add thinking message
    const thinkingMessageId = Date.now() + 1;
    const thinkingMessage: Message = {
      id: thinkingMessageId,
      text: 'Thinking...',
      sender: 'system',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, thinkingMessage]);

    try {
      // Отправляем запрос в Ollama
      const aiResponse: AIResponse = await sendToOllama(inputValue);
      
      // Remove thinking message and add AI response
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== thinkingMessageId);
        return [
          ...filtered,
          {
            id: Date.now() + 2,
            text: JSON.stringify(aiResponse, null, 2),
            sender: 'ai',
            timestamp: new Date(),
          }
        ];
      });

      // Process AI response
      await processAIResponse(aiResponse);

    } catch (error) {
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== thinkingMessageId);
        return [
          ...filtered,
          {
            id: Date.now() + 2,
            text: `Error: ${(error as Error).message}`,
            sender: 'system',
            timestamp: new Date(),
          }
        ];
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processAIResponse = async (data: AIResponse) => {
    try {
      // Process actions
      if (data.actions && Array.isArray(data.actions)) {
        for (const action of data.actions) {
          // Add system message
          setMessages(prev => [
            ...prev,
            {
              id: Date.now() + 3,
              text: `Executing: ${action.command} ${action.filename || ''}`,
              sender: 'system',
              timestamp: new Date(),
            }
          ]);

          // Execute action based on type
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
            default:
              console.log('Unknown action:', action.command);
          }
        }
      }

      // Run commands
      if (data.commands && Array.isArray(data.commands)) {
        for (const command of data.commands) {
          setMessages(prev => [
            ...prev,
            {
              id: Date.now() + 4,
              text: `Running command: ${command}`,
              sender: 'system',
              timestamp: new Date(),
            }
          ]);

          const result = await window.electron.runCommandInContainer(containerId, command);
          if (result.success) {
            setMessages(prev => [
              ...prev,
              {
                id: Date.now() + 5,
                text: `Command output:\n${result.result}`,
                sender: 'system',
                timestamp: new Date(),
              }
            ]);
          }
        }
      }

      // Пересобираем проект после выполнения всех действий
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 6,
          text: 'Rebuilding project with new changes...',
          sender: 'system',
          timestamp: new Date(),
        }
      ]);

      try {
        const rebuildResult = await window.electron.rebuildProject(containerId, port);
        if (rebuildResult.success) {
          setMessages(prev => [
            ...prev,
            {
              id: Date.now() + 7,
              text: 'Project rebuilt successfully!',
              sender: 'system',
              timestamp: new Date(),
            }
          ]);
        } else {
          throw new Error(rebuildResult.error || 'Unknown rebuild error');
        }
      } catch (rebuildError) {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 7,
            text: `Failed to rebuild project: ${(rebuildError as Error).message}`,
            sender: 'system',
            timestamp: new Date(),
          }
        ]);
      }

    } catch (error) {
      console.error('Error processing AI response:', error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 8,
          text: `Failed to process AI response: ${(error as Error).message}`,
          sender: 'system',
          timestamp: new Date(),
        }
      ]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>AI Assistant</h2>
      </div>
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-content">
              <pre>{message.text}</pre>
            </div>
            <div className="message-time">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type your message here..."
          disabled={isProcessing}
          rows={3}
        />
        <button 
          onClick={handleSendMessage} 
          disabled={isProcessing || !inputValue.trim()}
        >
          {isProcessing ? 'Processing...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
