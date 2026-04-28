import { Tabs } from "@ark-ui/solid/tabs";
import { type Component, For } from "solid-js";

import type { MemosCollection } from "../../db/memoCollection";
import { updateSidebarTab, useSidebarTab } from "../../store/configStore";
import type { Memo, MemoWithoutContent } from "../../types/memo";
import { AttachmentsTab } from "./tabs/AttachmentsTab";
import { ExplorerTab } from "./tabs/ExplorerTab";

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  onInsert: (memo: Omit<Memo, "content" | "createdAt" | "updatedAt">) => void;
  allMemos: MemoWithoutContent[];
  memosCollection: MemosCollection;
}

// ---------------------------------------------------------------------------
// Tab registry
// To add a new tab: push an entry here and add a <Tabs.Content> block below.
// ---------------------------------------------------------------------------

interface TabDef {
  id: string;
  /** UnoCSS icon class (Material Symbols) */
  icon: string;
  label: string;
}

const TAB_DEFS: TabDef[] = [
  {
    id: "explorer",
    icon: "i-material-symbols:folder-outline-rounded",
    label: "Explorer",
  },
  {
    id: "attachments",
    icon: "i-material-symbols:image-outline-rounded",
    label: "Attachments",
  },
];

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

const Sidebar: Component<SidebarProps> = (props) => {
  const activeTab = useSidebarTab();

  return (
    <Tabs.Root
      orientation="vertical"
      value={activeTab()}
      onValueChange={(details) => updateSidebarTab(details.value)}
      lazyMount
      class="flex h-full w-full overflow-hidden"
    >
      {/* ── Narrow icon activity bar ─────────────────────────────────────── */}
      <Tabs.List class="border-border-primary bg-surface-primary flex w-10 shrink-0 flex-col items-center gap-0.5 border-r py-1">
        <For each={TAB_DEFS}>
          {(tab) => (
            <Tabs.Trigger
              value={tab.id}
              title={tab.label}
              // `group` enables group-data-[selected] on the indicator child
              class="group focus-ring text-text-secondary text-text-primary data-[selected]:text-text-accent hover:bg-surface-transparent-hover relative flex size-8 items-center justify-center rounded bg-transparent transition-colors"
            >
              {/* Left-edge active indicator (VS Code-style) */}
              <span class="bg-text-accent pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-r opacity-0 transition-opacity group-data-[selected]:opacity-100" />
              <span class={`${tab.icon} size-[1.125rem] shrink-0`} />
            </Tabs.Trigger>
          )}
        </For>
      </Tabs.List>

      {/* ── Tab content panels ─────────────────────────────────────────── */}
      {/*
        data-[state=inactive]:hidden hides inactive panels without affecting
        layout of the active panel (Ark UI sets data-state on Tabs.Content).
      */}
      <div class="min-w-0 flex-1 overflow-hidden">
        <Tabs.Content value="explorer" class="h-full data-[state=inactive]:hidden">
          <ExplorerTab
            currentPath={props.currentPath}
            onNavigate={props.onNavigate}
            onDelete={props.onDelete}
            onInsert={props.onInsert}
            allMemos={props.allMemos}
            memosCollection={props.memosCollection}
          />
        </Tabs.Content>

        <Tabs.Content value="attachments" class="h-full data-[state=inactive]:hidden">
          <AttachmentsTab />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
};

export default Sidebar;
