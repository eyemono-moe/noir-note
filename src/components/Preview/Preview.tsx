import { type Component } from "solid-js";

import type { PreviewScrollAdapter } from "../../types/scrollSync";
import MarkdownRenderer from "./MarkdownRenderer";

interface PreviewProps {
  content: string;
  /** Called when a task list checkbox is clicked (Markdown mode only). */
  onCheckboxToggle?: (offset: number, checked: boolean) => void;
  /** Called with the scroll adapter once the renderer is ready (null on unmount). */
  onAdapterReady?: (adapter: PreviewScrollAdapter | null) => void;
}

const Preview: Component<PreviewProps> = (props) => {
  return (
    <MarkdownRenderer
      content={props.content}
      onCheckboxToggle={props.onCheckboxToggle}
      onAdapterReady={props.onAdapterReady}
    />
  );
};

export default Preview;
