'use client';

import React, { useState, useMemo } from 'react';
import { Folder, FolderOpen, File, FileCode, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FileNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: Record<string, FileNode>;
}

interface FileExplorerProps {
  files: { path: string }[];
  onFileClick: (path: string) => void;
}

// Convert flat file paths into a nested tree node structure
function buildTree(paths: { path: string }[]): FileNode {
  const root: FileNode = {
    name: 'root',
    path: '',
    isFolder: true,
    children: {},
  };

  for (const item of paths) {
    const parts = item.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partPath = parts.slice(0, i + 1).join('/');
      const isLast = i === parts.length - 1;

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: partPath,
          isFolder: !isLast,
          children: {},
        };
      }
      current = current.children[part];
    }
  }

  return root;
}

export function FileExplorer({ files, onFileClick }: FileExplorerProps) {
  const [search, setSearch] = useState('');

  const filteredFiles = useMemo(() => {
    if (!search) return files;
    const cleanSearch = search.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(cleanSearch));
  }, [files, search]);

  const treeRoot = useMemo(() => buildTree(filteredFiles), [filteredFiles]);

  return (
    <div className="flex flex-col h-full bg-card/30 backdrop-blur-sm border-r border-border w-full">
      <div className="p-4 border-b border-border flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Codebase Explorer
          </span>
          <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
            {files.length} Files
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="h-8 pl-8 text-xs bg-card"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {Object.values(treeRoot.children)
            .sort((a, b) => {
              // Folders first, then alphabetically
              if (a.isFolder && !b.isFolder) return -1;
              if (!a.isFolder && b.isFolder) return 1;
              return a.name.localeCompare(b.name);
            })
            .map((node) => (
              <FileTreeNode key={node.path} node={node} onFileClick={onFileClick} />
            ))}
        </ul>
      </div>
    </div>
  );
}

function FileTreeNode({
  node,
  onFileClick,
  level = 0,
}: {
  node: FileNode;
  onFileClick: (path: string) => void;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(true);

  const hasChildren = Object.keys(node.children).length > 0;

  const handleNodeClick = () => {
    if (node.isFolder) {
      setIsOpen(!isOpen);
    } else {
      onFileClick(node.path);
    }
  };

  const extension = node.name.split('.').pop() || '';
  const getFileIcon = () => {
    if (node.isFolder) {
      return isOpen ? (
        <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
      ) : (
        <Folder className="w-4 h-4 text-primary flex-shrink-0" />
      );
    }

    if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'rs', 'go', 'java', 'html', 'css'].includes(extension)) {
      return <FileCode className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    }

    return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
  };

  return (
    <li>
      <button
        onClick={handleNodeClick}
        style={{ paddingLeft: `${level * 12 + 6}px` }}
        className={cn(
          "flex items-center gap-2 w-full py-1 rounded text-left text-xs hover:bg-muted font-mono transition-colors cursor-pointer",
          !node.isFolder && "text-muted-foreground hover:text-foreground"
        )}
      >
        {node.isFolder ? (
          isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <span className="w-3.5" />
        )}
        {getFileIcon()}
        <span className="truncate">{node.name}</span>
      </button>

      {node.isFolder && isOpen && hasChildren && (
        <ul className="mt-0.5 space-y-0.5">
          {Object.values(node.children)
            .sort((a, b) => {
              if (a.isFolder && !b.isFolder) return -1;
              if (!a.isFolder && b.isFolder) return 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                onFileClick={onFileClick}
                level={level + 1}
              />
            ))}
        </ul>
      )}
    </li>
  );
}
export default FileExplorer;
