import { EditorView } from "@codemirror/view";
import { githubDark } from "@fsegurai/codemirror-theme-github-dark";
import { githubLight } from "@fsegurai/codemirror-theme-github-light";

const customizations = EditorView.theme({
  "&": {
    height: "100%",
  },
  ".cm-content": {
    padding: "16px",
  },
});

export const lightTheme = [githubLight, customizations];
export const darkTheme = [githubDark, customizations];
