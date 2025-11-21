import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileItem[];
  isExpanded?: boolean;
}

const CodeEditorPanel: React.FC<{ containerId: string }> = ({ containerId }) => {
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ 
    visible: boolean; 
    x: number; 
    y: number; 
    file: FileItem | null 
  }>({ visible: false, x: 0, y: 0, file: null });

  // Загружаем список файлов при монтировании и при смене контейнера
  useEffect(() => {
    loadFileTree();
  }, [containerId]);

  // Загружаем содержимое файла при выборе
  useEffect(() => {
    if (selectedFile && selectedFile.type === 'file') {
      loadFileContent(selectedFile.path);
    } else {
      setFileContent('');
    }
  }, [selectedFile, containerId]);

  const buildFileTree = (files: string[]): FileItem[] => {
    const root: FileItem[] = [];
    const map: Record<string, FileItem> = {};

    // Создаем все элементы
    files.forEach(filePath => {
      const parts = filePath.split('/').filter(Boolean);
      let currentPath = '';
      
      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = index === parts.length - 1;
        
        if (!map[currentPath]) {
          map[currentPath] = {
            id: currentPath,
            name: part,
            type: isFile ? 'file' : 'folder',
            path: currentPath,
            children: isFile ? undefined : [],
            isExpanded: false
          };
        }
      });
    });

    // Строим иерархию
    Object.values(map).forEach(item => {
      const parts = item.path.split('/').filter(Boolean);
      if (parts.length === 1) {
        // Корневой элемент
        root.push(item);
      } else {
        // Дочерний элемент
        const parentPath = parts.slice(0, -1).join('/');
        if (map[parentPath] && map[parentPath].children) {
          map[parentPath].children!.push(item);
        }
      }
    });

    // Сортируем элементы
    const sortItems = (items: FileItem[]): FileItem[] => {
      return items.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      }).map(item => {
        if (item.children) {
          item.children = sortItems(item.children);
        }
        return item;
      });
    };

    return sortItems(root);
  };

  const loadFileTree = async () => {
    setLoading(true);
    try {
      const result = await window.electron.listFilesInContainer(containerId);
      if (result.success && result.files) {
        const tree = buildFileTree(result.files);
        setFileTree(tree);
      }
    } catch (error) {
      console.error('Failed to load file tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFileContent = async (filePath: string) => {
    try {
      const result = await window.electron.readFileInContainer(containerId, filePath);
      if (result.success && result.content !== undefined) {
        setFileContent(result.content);
      } else {
        setFileContent('Unable to load file content');
      }
    } catch (error) {
      console.error('Failed to load file content:', error);
      setFileContent('Error loading file content');
    }
  };

  const handleFileSelect = (file: FileItem) => {
    if (file.type === 'file') {
      setSelectedFile(file);
    } else {
      // Переключаем состояние раскрытия для папок
      const updateTree = (items: FileItem[]): FileItem[] => {
        return items.map(item => {
          if (item.id === file.id) {
            return { ...item, isExpanded: !item.isExpanded };
          }
          if (item.children) {
            return { ...item, children: updateTree(item.children) };
          }
          return item;
        });
      };
      
      setFileTree(prev => updateTree(prev));
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || '';
    setFileContent(newContent);
    
    // В реальном приложении здесь будет сохранение файла
    // Пока просто обновляем состояние
  };

  const handleContextMenu = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      file: file
    });
  };

  const handleContextMenuAction = async (action: string) => {
    if (!contextMenu.file) return;
    
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
    
    switch (action) {
      case 'open':
        if (contextMenu.file.type === 'file') {
          setSelectedFile(contextMenu.file);
        }
        break;
      case 'download':
        // В реальном приложении здесь будет скачивание файла
        alert(`Download ${contextMenu.file.path}`);
        break;
      case 'rename':
        const newName = prompt('Enter new name:', contextMenu.file.name);
        if (newName) {
          // В реальном приложении здесь будет переименование файла
          alert(`Rename ${contextMenu.file.path} to ${newName}`);
        }
        break;
      case 'delete':
        if (window.confirm(`Delete ${contextMenu.file.path}?`)) {
          // В реальном приложении здесь будет удаление файла
          alert(`Delete ${contextMenu.file.path}`);
        }
        break;
    }
  };

  const handleClickOutside = () => {
    if (contextMenu.visible) {
      setContextMenu({ visible: false, x: 0, y: 0, file: null });
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.visible]);

  const renderFileTree = (items: FileItem[], level = 0) => {
    return (
      <ul className="file-tree-list" style={{ paddingLeft: level > 0 ? '20px' : '0' }}>
        {items.map(item => (
          <li 
            key={item.id} 
            className={`file-item ${item.type} ${selectedFile?.id === item.id ? 'selected' : ''}`}
            onClick={() => handleFileSelect(item)}
            onContextMenu={(e) => handleContextMenu(e, item)}
          >
            <div className="file-item-content">
              <span className="file-icon">
                {item.type === 'folder' ? (
                  <span className="expander">{item.isExpanded ? '📂' : '📁'}</span>
                ) : (
                  '📄'
                )}
              </span>
              <span className="file-name" title={item.path}>{item.name}</span>
              <span className="context-menu-button">⋮</span>
            </div>
            {item.type === 'folder' && item.isExpanded && item.children && (
              <div className="folder-children">
                {renderFileTree(item.children, level + 1)}
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="code-editor-panel">
      <div className="panel-header">
        <h2>Code Editor</h2>
      </div>
      <div className="code-editor-content">
        <div className="file-explorer">
          <div className="explorer-header">
            <h3>Explorer</h3>
            <button onClick={loadFileTree} disabled={loading}>
              {loading ? '🔄' : '🔄'}
            </button>
          </div>
          <div className="file-tree">
            {loading ? (
              <div className="loading">Loading files...</div>
            ) : fileTree.length > 0 ? (
              renderFileTree(fileTree)
            ) : (
              <div className="empty">No files found</div>
            )}
          </div>
        </div>
        <div className="editor-container">
          {selectedFile ? (
            <div className="editor-wrapper">
              <div className="editor-header">
                <span>{selectedFile.path}</span>
              </div>
              <Editor
                height="100%"
                defaultLanguage={selectedFile.name.endsWith('.tsx') ? 'typescript' : 
                               selectedFile.name.endsWith('.ts') ? 'typescript' : 
                               selectedFile.name.endsWith('.js') ? 'javascript' : 
                               selectedFile.name.endsWith('.json') ? 'json' : 'plaintext'}
                value={fileContent}
                onChange={handleEditorChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: 'on'
                }}
              />
            </div>
          ) : (
            <div className="editor-placeholder">
              <p>Select a file to edit</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          className="context-menu"
          style={{ 
            position: 'fixed', 
            top: contextMenu.y, 
            left: contextMenu.x,
            zIndex: 1000
          }}
        >
          <ul>
            <li onClick={() => handleContextMenuAction('open')}>Open</li>
            <li onClick={() => handleContextMenuAction('download')}>Download</li>
            <li onClick={() => handleContextMenuAction('rename')}>Rename</li>
            <li onClick={() => handleContextMenuAction('delete')}>Delete</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default CodeEditorPanel;
