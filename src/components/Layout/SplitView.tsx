import type { Component, JSX } from "solid-js";

interface SplitViewProps {
  left: JSX.Element;
  right: JSX.Element;
}

const SplitView: Component<SplitViewProps> = (props) => {
  return (
    <div class="h-full w-full grid grid-cols-2 gap-0">
      <div class="h-full overflow-hidden border-r border-gray-200">{props.left}</div>
      <div class="h-full overflow-hidden">{props.right}</div>
    </div>
  );
};

export default SplitView;
