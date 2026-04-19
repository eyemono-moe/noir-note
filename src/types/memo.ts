export interface Memo {
  path: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  metadata?: MemoFrontmatter;
}

export type MemoWithoutContent = Omit<Memo, "content">;

export interface MemoFrontmatter {
  tags?: string[];
  title?: string;
  [key: string]: unknown;
}
