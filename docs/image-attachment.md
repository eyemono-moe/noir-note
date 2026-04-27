# 画像添付機能 設計ドキュメント

## 概要

ローカルファーストを維持しつつ、マークダウンノートへの画像ペースト/ドラッグ添付を実現する。
ストレージとして **OPFS (Origin Private File System)** を採用する。

---

## 技術選定: OPFS

| 比較項目                 | RxDB Attachments                     | **OPFS (採用)**                    |
| ------------------------ | ------------------------------------ | ---------------------------------- |
| バイナリ保存効率         | base64 で +33% オーバーヘッド        | ネイティブファイル (ゼロ overhead) |
| RxDB スキーマ変更        | schema version bump + migration 必要 | 不要                               |
| ノート削除クリーンアップ | RxDB が自動処理                      | 手動 (コマンド経由)                |
| 将来のノート移行         | 再設計が必要                         | そのまま拡張可能                   |
| ストレージ効率           | IndexedDB クォータ内                 | 同クォータだが実装が効率的         |

### OPFS とは

Origin Private File System は、ブラウザが各オリジン専用に提供するプライベートなファイルシステム。
ユーザーのファイルマネージャからは不可視で、プログラムから自由に読み書きできる。
IndexedDB と同じストレージクォータを使用するが、バイナリデータの扱いが効率的。

**ブラウザサポート**: Chrome 86+, Firefox 111+, Safari 15.2+

---

## ストレージ設計

### OPFS ディレクトリ構造

```
OPFS (navigator.storage.getDirectory())
└── attachments/
    ├── {uuid}-{sanitized-filename}   例: 550e8400-e29b-...-screenshot.png
    ├── {uuid}-{sanitized-filename}
    └── ...
```

**フラット構造を採用する理由:**

- 複数ノートからの同一画像参照を自然にサポートできる
- ノートのパス変更・移動の影響を受けない
- クリーンアップ (参照スキャン) の実装がシンプル

### マークダウン内の参照フォーマット

```markdown
![スクリーンショット](attachment://550e8400-e29b-41d4-a716-446655440000-screenshot.png)
```

- `attachment://` スキームで通常の外部 URL と明確に区別
- ノートの置かれたパス階層に依存しない (相対パスではなく専用スキームを使用)

### ファイル名の生成ルール

```
{crypto.randomUUID()}-{sanitized-original-filename}
```

- `sanitized-original-filename`: 英数字・`.`・`-`・`_` のみ残し、それ以外は `-` に置換、最大 100 文字
- クリップボードからのスクリーンショットペースト時: `screenshot-{YYYYMMDD-HHmmss}.png` を生成

---

## 設計上の決定事項

### クロスノート参照

**決定**: 複数ノートから同一画像を参照可能。

```
ノートA: ![img](attachment://uuid-photo.png)
ノートB: ![img](attachment://uuid-photo.png)  ← 同じ画像を参照可能
```

- ノートA で添付した画像のリンクをノートB にコピーしてもプレビューが機能する
- OPFS はグローバルな平坦ストアなので、参照先の存在はリンクだけで決まる

### クリーンアップ戦略

**決定**: 自動クリーンアップなし。`cleanup-unused-attachments` コマンド実行時のみ削除。

**理由**: クロスノート参照をサポートする場合、ノート削除時にそのノートにしか参照がないか全ノートを検索する必要がある。
この処理を毎回自動実行するよりも、ユーザーが明示的にコマンドを実行する方がシンプルかつ安全。

クリーンアップ処理の概要:

1. 全ノートの `content` を取得
2. `attachment://` を含む全リンクを抽出・集計
3. OPFS に存在するがどのノートからも参照されていないファイルを削除

### 将来のエクスポート対応

エクスポート時 (今回のスコープ外) に以下の変換を行う:

```
内部形式:  ![alt](attachment://uuid-filename.png)
           ↓ エクスポート変換
外部形式:  ![alt](./attachments/uuid-filename.png)
```

zip 内の構造:

```
export.zip/
├── notes/
│   ├── index.md          → ./attachments/uuid-a.png (ルートノートの画像)
│   └── work/
│       └── meeting.md    → ./attachments/uuid-b.png (meeting ノートの画像)
└── attachments/          ← 参照されている画像をすべてコピー
    ├── uuid-a.png
    └── uuid-b.png
```

### ストレージ容量表示

添付ファイルマネージャ UI (Phase 3) で以下を表示:

- 添付画像の総容量 (OPFS ファイルサイズ合計)
- ブラウザのストレージクォータと使用量 (`navigator.storage.estimate()`)

---

## 実装フェーズ

### Phase 1: コア機能 (MVP)

- [x] `src/db/imageStore.ts` — OPFS ラッパー (保存・取得・一覧・削除)
- [x] `src/editor/imagePaste.ts` — CodeMirror ペースト/ドロップ拡張
- [x] `src/editor/extensions.ts` — imagePaste 拡張の登録
- [x] `src/components/Preview/MarkdownRenderer.tsx` — `attachment://` スキーム対応

### Phase 2: クリーンアップコマンド

- [ ] `src/commands/definitions/attachments.ts` — `cleanup-unused-attachments` コマンド
- [ ] `src/commands/definitions/index.ts` — コマンド登録

### Phase 3: 添付ファイルマネージャ UI

- [ ] `src/components/Attachments/AttachmentManager.tsx` — 添付ファイル一覧
  - ファイル名・サイズ・参照ノート一覧
  - 未参照ファイルのハイライト + 個別削除
  - ストレージ使用量表示 (総容量 / クォータ)
- [ ] コマンドパレットまたはサイドバーからアクセス可能にする

---

## ファイル構成

```
src/
├── db/
│   └── imageStore.ts          # OPFS ラッパー (新規)
├── editor/
│   └── imagePaste.ts          # ペースト/ドロップ拡張 (新規)
│   └── extensions.ts          # imagePaste を追加 (変更)
├── components/
│   ├── Preview/
│   │   └── MarkdownRenderer.tsx  # ImageNode を attachment:// 対応 (変更)
│   └── Attachments/           # Phase 3
│       └── AttachmentManager.tsx
└── commands/
    └── definitions/
        ├── attachments.ts     # Phase 2 (新規)
        └── index.ts           # Phase 2 (変更)
```

---

## API 設計 (imageStore.ts)

```typescript
// 画像を保存し、OPFS 内のファイル名 (UUID ベース) を返す
saveImage(file: File): Promise<string>

// attachment ID から object URL を生成して返す (表示用)
getImageUrl(id: string): Promise<string | null>

// 画像を削除
deleteImage(id: string): Promise<void>

// 全添付ファイルのメタデータ一覧を返す
listImages(): Promise<ImageMeta[]>

// interface ImageMeta { id: string; size: number; lastModified: number }

// 総容量 (bytes) を返す
getTotalSize(): Promise<number>

// ストレージクォータ情報を返す
getStorageEstimate(): Promise<StorageEstimate>
```
