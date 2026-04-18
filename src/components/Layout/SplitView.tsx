import { Splitter, type UseSplitterReturn } from "@ark-ui/solid/splitter";
import type { Component, JSX } from "solid-js";

import styles from "./splitView.module.css";

interface SplitViewProps {
  left: JSX.Element;
  center: JSX.Element;
  right: JSX.Element;
  splitter: UseSplitterReturn;
}

const SplitView: Component<SplitViewProps> = (props) => {
  return (
    <Splitter.RootProvider value={props.splitter} class={styles.Root}>
      <Splitter.Panel id="left" class={styles.Panel}>
        {props.left}
      </Splitter.Panel>
      <Splitter.ResizeTrigger
        id="left:center"
        aria-label="Resize"
        class={styles.ResizeTrigger}
        onDblClick={() => {
          props.splitter().resetSizes();
        }}
      >
        <Splitter.ResizeTriggerIndicator class={styles.ResizeTriggerIndicator} />
      </Splitter.ResizeTrigger>
      <Splitter.Panel id="center" class={styles.Panel}>
        {props.center}
      </Splitter.Panel>
      <Splitter.ResizeTrigger
        id="center:right"
        aria-label="Resize"
        class={styles.ResizeTrigger}
        onDblClick={() => {
          props.splitter().resetSizes();
        }}
      >
        <Splitter.ResizeTriggerIndicator class={styles.ResizeTriggerIndicator} />
      </Splitter.ResizeTrigger>
      <Splitter.Panel id="right" class={styles.Panel}>
        {props.right}
      </Splitter.Panel>
    </Splitter.RootProvider>
  );
};

export default SplitView;
