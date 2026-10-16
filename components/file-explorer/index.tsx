'use client';

import React, { useState, useMemo } from 'react';
import { Folder, FolderOpen, FileCode2, File, Search, ChevronRight } from 'lucide-react';
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
  selectedPath?: string | null;
  className?: string;
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

function sortNodes(a: FileNode, b: FileNode): number {
  // Folders first, then alphabetically
  if (a.isFolder && !b.isFolder) return -1;
  if (!a.isFolder && b.isFolder) return 1;
  return a.name.localeCompare(b.name);
}

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'py', 'rb',
  'rs', 'go', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp',
  'cs', 'sql', 'html', 'css', 'scss', 'vue', 'svelte', 'sh',
]);

export function FileExplorer({ files, onFileClick, selectedPath, className }: FileExplorerProps) {
  const [search, setSearch] = useState('');

  const filteredFiles = useMemo(() => {
    if (!search) return files;
    const cleanSearch = search.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(cleanSearch));
  }, [files, search]);

  const treeRoot = useMemo(() => buildTree(filteredFiles), [filteredFiles]);
  const searching = search.length > 0;

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background', className)}>
      {/* overflow-hidden doubles as the flex-minimum kill (see repo page). */}
      <div className="flex flex-col gap-2.5 border-b border-border p-3">
        <div className="flex items-center justify-between px-0.5">
          <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            Explorer
          </span>
          <span className="font-mono text-[11px] text-muted-foreground tabular">
            {searching ? `${filteredFiles.length} / ${files.length}` : files.length}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          {/* Not a credential field: neutral name + autocomplete off so
              browser/password-manager login heuristics (triggered by the
              API-key password field elsewhere on the page) never pair this
              input as a "username" and fill an email into it. */}
          <Input
            id="explorer-path-filter"
            name="devask-path-filter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter paths…"
            aria-label="Filter files by path"
            autoComplete="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            className="h-8 bg-card pr-2 pl-8 font-mono text-xs"
          />
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-1.5 [scrollbar-gutter:stable]"
        role="tree"
        aria-label="Repository files"
      >
        {filteredFiles.length === 0 ? (
          searching ? (
            <div className="px-2.5 py-4">
              <p className="text-xs font-medium text-foreground/90">No files found</p>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">Try:</p>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                <li aria-hidden>• checking the filename</li>
                <li aria-hidden>• searching by folder</li>
                <li aria-hidden>• using a broader term</li>
              </ul>
              <span className="sr-only">
                Checking the filename, searching by folder, or using a broader term.
              </span>
            </div>
          ) : (
            <p className="px-2.5 py-4 text-xs text-muted-foreground">No files indexed yet.</p>
          )
        ) : (
          <ul className="space-y-px">
            {Object.values(treeRoot.children)
              .sort(sortNodes)
              .map((node) => (
                <FileTreeNode
                  key={node.path}
                  node={node}
                  onFileClick={onFileClick}
                  selectedPath={selectedPath}
                  forceOpen={searching}
                />
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FileTreeNode({
  node,
  onFileClick,
  selectedPath,
  forceOpen,
  level = 0,
}: {
  node: FileNode;
  onFileClick: (path: string) => void;
  selectedPath?: string | null;
  forceOpen?: boolean;
  level?: number;
}) {
  // Top-level folders start open; deeper levels start collapsed so large
  // trees stay scannable. Searching force-opens everything.
  const [isOpen, setIsOpen] = useState(level < 1);
  const open = forceOpen || isOpen;

  const hasChildren = Object.keys(node.children).length > 0;
  const selected = !node.isFolder && selectedPath === node.path;

  const handleNodeClick = () => {
    if (node.isFolder) {
      setIsOpen(!isOpen);
    } else {
      onFileClick(node.path);
    }
  };

  const extension = node.name.includes('.') ? (node.name.split('.').pop() ?? '') : '';

  return (
    <li role="treeitem" aria-expanded={node.isFolder ? open : undefined} aria-selected={selected || undefined}>
      <button
        type="button"
        onClick={handleNodeClick}
        style={{ paddingLeft: `${level * 14 + 6}px` }}
        title={node.path}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-[4px] py-[5px] pr-2 text-left font-mono text-xs transition-colors',
          selected
            ? 'bg-accent text-foreground'
            : node.isFolder
              ? 'text-foreground/80 hover:bg-accent/60 hover:text-foreground'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
        )}
      >
        {node.isFolder ? (
          <ChevronRight
            className={cn(
              'h-3 w-3 flex-shrink-0 text-muted-foreground/70 transition-transform',
              open && 'rotate-90'
            )}
          />
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        {node.isFolder ? (
          open ? (
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          )
        ) : CODE_EXTENSIONS.has(extension.toLowerCase()) ? (
          <FileCode2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        ) : (
          <File className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60" />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {node.isFolder && open && hasChildren && (
        <ul className="mt-px space-y-px">
          {Object.values(node.children)
            .sort(sortNodes)
            .map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                onFileClick={onFileClick}
                selectedPath={selectedPath}
                forceOpen={forceOpen}
                level={level + 1}
              />
            ))}
        </ul>
      )}
    </li>
  );
}
export default FileExplorer;
