/**
 * FeatureCheckGate — blocks the app from rendering when required browser
 * features are unavailable (e.g. OPFS blocked by strict privacy settings).
 *
 * Required features:
 *   - Origin Private File System (OPFS) — stores all notes
 *   - Web Workers                       — runs the OPFS note-store worker
 *
 * Non-critical features (warning banner only):
 *   - localStorage — config persistence; falls back to in-memory automatically
 *     (see configStore.ts)
 */

import {
  type Component,
  createSignal,
  For,
  Match,
  onMount,
  type ParentComponent,
  Show,
  Switch,
} from "solid-js";

// ---------------------------------------------------------------------------
// OPFS availability probe
//
// The main-thread navigator.storage.getDirectory() call may succeed even when
// the browser blocks OPFS inside Web Workers (the context the actual note-store
// worker runs in).  We create a throwaway inline Worker that performs the same
// call so the check reflects real-world access conditions.
// ---------------------------------------------------------------------------

async function checkOpfsInWorker(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const code =
      "self.onmessage=async()=>{try{await navigator.storage.getDirectory();self.postMessage(true)}catch{self.postMessage(false)}};";

    let blobUrl: string;
    try {
      blobUrl = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
    } catch {
      // Blob URL creation failed — treat as unavailable.
      resolve(false);
      return;
    }

    const worker = new Worker(blobUrl);

    // Guard against a permanently hung worker (e.g. in some sandboxed environments).
    const timer = setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      worker.terminate();
      resolve(false);
    }, 5000);

    worker.onmessage = (e: MessageEvent<boolean>) => {
      clearTimeout(timer);
      URL.revokeObjectURL(blobUrl);
      worker.terminate();
      resolve(e.data);
    };

    worker.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(blobUrl);
      resolve(false);
    };

    worker.postMessage(null);
  });
}

// ---------------------------------------------------------------------------
// Error screen — shown when a critical feature is unavailable
// ---------------------------------------------------------------------------

const FeatureErrorScreen: Component<{ missing: string[] }> = (props) => (
  <div class="bg-surface-primary text-text-primary flex min-h-screen w-screen flex-col items-center justify-center gap-4 overflow-y-auto p-8">
    <span class="i-material-symbols:warning-outline-rounded text-text-accent size-12 shrink-0" />
    <h1 class="text-text-primary text-xl font-semibold">Storage access required</h1>
    <p class="text-text-secondary max-w-md text-center text-sm">
      eyemono.md stores all notes locally in your browser. The following features are currently
      blocked and must be allowed for the app to work:
    </p>
    <ul class="text-text-secondary list-inside list-disc text-sm">
      <For each={props.missing}>{(feature) => <li>{feature}</li>}</For>
    </ul>
    <p class="text-text-secondary max-w-md text-center text-sm">
      Please allow site storage access in your browser settings, then reload the page.
    </p>
    <button type="button" class="button text-sm" onClick={() => window.location.reload()}>
      <span class="i-material-symbols:refresh-rounded size-4 shrink-0" />
      Reload
    </button>

    {/* Scratch pad — jot notes while the app is unavailable */}
    <div class="border-border-primary mt-2 w-full max-w-lg border-t pt-4">
      <p class="text-text-secondary mb-2 text-center text-xs">Scratch pad — not saved</p>
      <textarea
        id="scratch-pad"
        class="bg-surface-secondary text-text-primary border-border-primary focus:border-border-accent w-full resize-y rounded-lg border p-3 font-mono text-sm transition-colors outline-none"
        placeholder="You can jot temporary notes here while the app is unavailable…"
        rows={6}
        spellcheck={false}
      />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Warning banner — shown when only localStorage is unavailable
// ---------------------------------------------------------------------------

const LocalStorageWarningBanner: Component<{ onDismiss: () => void }> = (props) => (
  <div class="border-border-primary bg-surface-secondary fixed top-0 right-0 left-0 z-50 flex items-center gap-2 border-b px-4 py-2 text-xs shadow-sm">
    <span class="i-material-symbols:warning-outline-rounded text-text-accent size-4 shrink-0" />
    <span class="text-text-secondary flex-1">
      Settings cannot be saved — localStorage is blocked. Allow site storage in your browser
      settings to persist your preferences.
    </span>
    <button
      type="button"
      class="focus-ring hover:bg-surface-transparent-hover text-text-secondary appearance-none rounded bg-transparent p-1 transition-colors"
      onClick={() => props.onDismiss()}
      aria-label="Dismiss"
    >
      <span class="i-material-symbols:close-rounded block size-4" />
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

const FeatureCheckGate: ParentComponent = (props) => {
  type Status = "checking" | "ok" | "error";
  const [status, setStatus] = createSignal<Status>("checking");
  const [missingFeatures, setMissingFeatures] = createSignal<string[]>([]);
  const [showLocalStorageWarning, setShowLocalStorageWarning] = createSignal(false);

  onMount(async () => {
    // --- localStorage (sync) -----------------------------------------------
    let localStorageOk = true;
    try {
      window.localStorage.getItem("");
    } catch {
      localStorageOk = false;
    }

    // --- Web Workers (sync) ------------------------------------------------
    const workersOk = typeof Worker !== "undefined";

    // --- OPFS via worker (async) -------------------------------------------
    // Test OPFS access inside a throwaway Worker — mirrors the context that the
    // actual note-store worker uses.  The main-thread getDirectory() call alone
    // is insufficient: some browsers allow it on the main thread but deny it in
    // workers when site data is restricted.
    let opfsOk = false;
    if (workersOk) {
      opfsOk = await checkOpfsInWorker();
    }

    // --- Result -------------------------------------------------------------
    const missing: string[] = [];
    if (!workersOk) missing.push("Web Workers");
    if (!opfsOk) missing.push("Origin Private File System (OPFS)");

    if (missing.length > 0) {
      setMissingFeatures(missing);
      setStatus("error");
    } else {
      setShowLocalStorageWarning(!localStorageOk);
      setStatus("ok");
    }
  });

  return (
    <Switch>
      {/* "checking" — no Match matches; renders nothing while the async probe runs */}
      <Match when={status() === "error"}>
        <FeatureErrorScreen missing={missingFeatures()} />
      </Match>
      <Match when={status() === "ok"}>
        <Show when={showLocalStorageWarning()}>
          <LocalStorageWarningBanner onDismiss={() => setShowLocalStorageWarning(false)} />
        </Show>
        {props.children}
      </Match>
    </Switch>
  );
};

export default FeatureCheckGate;
