import { Splitter } from "@ark-ui/solid/splitter";
import type { Component, JSX } from "solid-js";

import styles from "./splitView.module.css";

interface SplitViewProps {
  left: JSX.Element;
  right: JSX.Element;
}

const SplitView: Component<SplitViewProps> = (props) => {
  return (
    <Splitter.Root panels={[{ id: "a" }, { id: "b" }]} defaultSize={[0.5, 0.5]} class={styles.Root}>
      <Splitter.Context>
        {(splitter) => (
          <>
            <Splitter.Panel id="a" class={styles.Panel}>
              {props.left}
            </Splitter.Panel>
            <Splitter.ResizeTrigger
              id="a:b"
              aria-label="Resize"
              class={styles.ResizeTrigger}
              onDblClick={() => {
                splitter().resetSizes();
              }}
            >
              <Splitter.ResizeTriggerIndicator class={styles.ResizeTriggerIndicator} />
            </Splitter.ResizeTrigger>
            <Splitter.Panel id="b" class={styles.Panel}>
              {props.right}
            </Splitter.Panel>
          </>
        )}
      </Splitter.Context>
    </Splitter.Root>
  );
};

export default SplitView;
