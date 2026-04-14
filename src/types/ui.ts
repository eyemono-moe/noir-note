export type ViewMode = "edit" | "preview" | "split";

export interface UIState {
  viewMode: ViewMode;
  sidebarVisible: boolean;
}
