import { Octokit } from '@octokit/rest';

// --- File extensions to skip during indexing ---
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.bmp', '.tiff',
  '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.webm', '.wav', '.flac',
  '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.pyc', '.pyo', '.class', '.o', '.obj',
  '.db', '.sqlite', '.sqlite3',
  '.DS_Store',
]);

// --- Paths to always exclude ---
const EXCLUDED_PATHS = [
  'node_modules/',
  '.git/',
  '.next/',
  'dist/',
  'build/',
  '__pycache__/',
  '.venv/',
  'vendor/',
  '.gradle/',
  'target/',        // Rust/Java build output
];

// --- Lockfiles to skip ---
const LOCKFILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Gemfile.lock',
  'Pipfile.lock',
  'poetry.lock',
  'composer.lock',
  'Cargo.lock',
  'go.sum',
]);

// Max file size to fetch content for (1MB)
const MAX_FILE_SIZE = 1_000_000;

export interface GitHubFile {
  path: string;
  content: string;
  size: number;
}

/**
 * Create an authenticated Octokit client.
 * Prefers the user's GitHub OAuth token (private repos), falls back to the
 * server-side GITHUB_TOKEN PAT, else unauthenticated (public repos only).
 * Authenticated requests get 5,000/hr vs 60/hr unauthenticated — indexing
 * any real repo exceeds the anonymous quota, so the fallback matters.
 */
export function createOctokitClient(token?: string | null): Octokit {
  const auth = token || process.env.GITHUB_TOKEN || undefined;
  return new Octokit(auth ? { auth } : undefined);
}

/**
 * Parse a GitHub URL into owner and repo name.
 * Supports: https://github.com/owner/name, github.com/owner/name, etc.
 */
export function parseGitHubUrl(url: string): { owner: string; name: string } {
  const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '');
  const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }
  return { owner: match[1], name: match[2] };
}

/**
 * Check if a file path should be excluded from indexing.
 */
function shouldExclude(path: string): boolean {
  // Check excluded directories
  if (EXCLUDED_PATHS.some((excluded) => path.startsWith(excluded) || path.includes(`/${excluded}`))) {
    return true;
  }

  // Check lockfiles
  const filename = path.split('/').pop() || '';
  if (LOCKFILES.has(filename)) {
    return true;
  }

  // Check binary extensions
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}

/**
 * Recursively fetch the full file tree for a GitHub repo.
 * Returns just the list of file paths (not directories).
 */
export async function fetchFileTree(
  octokit: Octokit,
  owner: string,
  name: string
): Promise<{ path: string; size: number }[]> {
  const { data } = await octokit.git.getTree({
    owner,
    repo: name,
    tree_sha: 'HEAD',
    recursive: 'true',
  });

  return data.tree
    .filter((item) => item.type === 'blob' && item.path && item.size != null)
    .filter((item) => !shouldExclude(item.path!))
    .filter((item) => (item.size ?? 0) <= MAX_FILE_SIZE)
    .map((item) => ({ path: item.path!, size: item.size ?? 0 }));
}

/**
 * Fetch the content of a single file from a GitHub repo.
 * Returns the decoded UTF-8 content.
 */
export async function fetchFileContent(
  octokit: Octokit,
  owner: string,
  name: string,
  path: string
): Promise<string> {
  const { data } = await octokit.repos.getContent({
    owner,
    repo: name,
    path,
  });

  // Single file response has content as base64
  if ('content' in data && data.content) {
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  throw new Error(`Could not fetch content for ${path}`);
}

/**
 * Fetch all indexable files from a GitHub repo.
 * Orchestrates: tree fetch → filter → batch content fetch.
 * 
 * Uses a concurrency limit to avoid hitting GitHub API rate limits.
 */
export async function fetchAllFiles(
  octokit: Octokit,
  owner: string,
  name: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<GitHubFile[]> {
  const tree = await fetchFileTree(octokit, owner, name);
  const files: GitHubFile[] = [];
  const CONCURRENCY = 5;

  for (let i = 0; i < tree.length; i += CONCURRENCY) {
    const batch = tree.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const content = await fetchFileContent(octokit, owner, name, item.path);
        return { path: item.path, content, size: item.size };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        files.push(result.value);
        continue;
      }
      // Auth / rate-limit failures abort loudly: silently skipping here
      // would produce an empty index with a misleading error downstream.
      const status = (result.reason as { status?: number } | null)?.status;
      if (status === 401 || status === 403 || status === 429) {
        throw new Error(
          `GitHub API access denied or rate-limited (HTTP ${status}). ` +
            'Unauthenticated requests get 60/hour, which one repo index can exhaust. ' +
            'Set GITHUB_TOKEN in .env (a personal access token — no scopes needed for public repos) and retry.'
        );
      }
      // Silently skip files that fail to fetch (e.g., encoding issues)
    }

    onProgress?.(Math.min(i + CONCURRENCY, tree.length), tree.length);
  }

  return files;
}

/**
 * Auto-detect the primary language of a repo based on file extensions.
 * Returns the most common language, or null if undetermined.
 */
export function detectLanguage(files: { path: string }[]): string | null {
  const extMap: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.py': 'Python',
    '.rs': 'Rust',
    '.go': 'Go',
    '.java': 'Java',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.cs': 'C#',
    '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++',
    '.c': 'C', '.h': 'C',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.scala': 'Scala',
    '.dart': 'Dart',
    '.vue': 'Vue',
    '.svelte': 'Svelte',
  };

  const counts: Record<string, number> = {};
  for (const file of files) {
    const ext = '.' + file.path.split('.').pop()?.toLowerCase();
    const lang = extMap[ext];
    if (lang) {
      counts[lang] = (counts[lang] || 0) + 1;
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}
