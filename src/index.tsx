import "uno.css";
import "@unocss/reset/tailwind-compat.css";
import { render } from "solid-js/web";
import { Route, Router } from "@solidjs/router";

import App from "./App";
import MemoPage from "./routes/MemoPage";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  );
}

render(
  () => (
    <Router root={App}>
      <Route path="*" component={MemoPage} />
    </Router>
  ),
  root!,
);
