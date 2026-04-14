import { Splitter } from "@ark-ui/solid/splitter";
import type { Component, JSX } from "solid-js";
interface SplitViewProps {
  left: JSX.Element;
  right: JSX.Element;
}

const SplitView: Component<SplitViewProps> = (props) => {
  return (
    <Splitter.Root
      class="[--splitter-border-color:theme(colors.gray.200)] [--splitter-border-size:1px] [--splitter-handle-size:1.5rem] [--splitter-thumb-color:theme(colors.gray.300)] [--splitter-thumb-inset:calc(var(--splitter-thumb-size)*-0.5)] [--splitter-thumb-size:0.5rem]"
      panels={[{ id: "a" }, { id: "b" }]}
      defaultSize={[0.5, 0.5]}
    >
      <Splitter.Context>
        {(splitter) => (
          <>
            <Splitter.Panel id="a">{props.left}</Splitter.Panel>
            <Splitter.ResizeTrigger
              class="b-none m-inline-[--splitter-thumb-inset] before:content-empty before:inset-ie-[calc(var(--splitter-thumb-size)*0.5)] before:inset-block-0 before:inset-is-auto relative grid min-w-[--splitter-thumb-size] cursor-col-resize place-items-center bg-transparent p-0 outline-none before:absolute before:w-[--splitter-border-size] before:bg-[--splitter-border-color] focus:[--splitter-border-color:theme(colors.gray.400)] focus:[--splitter-thumb-color:theme(colors.gray.500)] data-[dragging]:[--splitter-border-color:theme(colors.gray.400)] data-[dragging]:[--splitter-thumb-color:theme(colors.gray.500)]"
              id="a:b"
              aria-label="Resize"
              onDblClick={() => {
                splitter().resetSizes();
              }}
            >
              <Splitter.ResizeTriggerIndicator class="relative z-1 h-[--splitter-handle-size] w-full rounded-full bg-[--splitter-thumb-color] shadow-sm" />
            </Splitter.ResizeTrigger>
            <Splitter.Panel id="b">{props.right}</Splitter.Panel>
          </>
        )}
      </Splitter.Context>
    </Splitter.Root>
  );
};

export default SplitView;
