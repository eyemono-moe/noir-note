export interface Memo {
  path: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  metadata?: MemoFrontmatter;
}

export interface MemoFrontmatter {
  tags?: string[];
  title?: string;
  [key: string]: unknown;
}

export interface MemoTreeMetadata {
  path: string;
  createdAt: number;
  updatedAt: number;
}
