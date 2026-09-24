/**
 * Compatibility bootstrap for older WebKit releases (notably iOS 12).
 *
 * Next loads this file before the application hydrates. Keep it dependency-free:
 * if a browser needs these fallbacks, it must not have to parse Firebase or React
 * first in order to install them.
 */

type IdleCallback = (deadline: {
  readonly didTimeout: boolean;
  timeRemaining: () => number;
}) => void;

type LegacyWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: IdleCallback) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

function installStringReplaceAll(): void {
  if (typeof String.prototype.replaceAll === "function") return;

  Object.defineProperty(String.prototype, "replaceAll", {
    configurable: true,
    writable: true,
    value(search: string | RegExp, replacement: string): string {
      if (search instanceof RegExp) {
        if (!search.global) {
          throw new TypeError("replaceAll requires a global regular expression");
        }
        return this.replace(search, replacement);
      }
      return this.split(String(search)).join(replacement);
    },
  });
}

function installArrayAt(): void {
  if (typeof Array.prototype.at === "function") return;

  Object.defineProperty(Array.prototype, "at", {
    configurable: true,
    writable: true,
    value(index: number) {
      const length = this.length >>> 0;
      const normalized = Math.trunc(Number(index) || 0);
      const position = normalized < 0 ? length + normalized : normalized;
      return position < 0 || position >= length ? undefined : this[position];
    },
  });
}

function installObjectFromEntries(): void {
  if (typeof Object.fromEntries === "function") return;

  Object.defineProperty(Object, "fromEntries", {
    configurable: true,
    writable: true,
    value(entries: Iterable<readonly [PropertyKey, unknown]>) {
      const result: Record<PropertyKey, unknown> = {};
      for (const entry of entries) result[entry[0]] = entry[1];
      return result;
    },
  });
}

function installPromiseAllSettled(): void {
  if (typeof Promise.allSettled === "function") return;

  Object.defineProperty(Promise, "allSettled", {
    configurable: true,
    writable: true,
    value<T>(values: Iterable<T | PromiseLike<T>>) {
      return Promise.all(
        Array.from(values, (value) =>
          Promise.resolve(value).then(
            (fulfilledValue) => ({ status: "fulfilled" as const, value: fulfilledValue }),
            (reason: unknown) => ({ status: "rejected" as const, reason }),
          ),
        ),
      );
    },
  });
}

function installRandomUuid(): void {
  if (typeof window.crypto?.randomUUID === "function") return;

  const randomUuid = (): `${string}-${string}-${string}-${string}-${string}` => {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  };

  Object.defineProperty(window.crypto, "randomUUID", {
    configurable: true,
    value: randomUuid,
  });
}

function installQueueMicrotask(): void {
  if (typeof window.queueMicrotask === "function") return;
  window.queueMicrotask = (callback: VoidFunction) => {
    void Promise.resolve().then(callback);
  };
}

function installIdleCallbacks(): void {
  const legacyWindow = window as LegacyWindow;
  if (typeof legacyWindow.requestIdleCallback !== "function") {
    legacyWindow.requestIdleCallback = (callback) =>
      window.setTimeout(
        () => callback({ didTimeout: false, timeRemaining: () => 0 }),
        1,
      );
  }
  if (typeof legacyWindow.cancelIdleCallback !== "function") {
    legacyWindow.cancelIdleCallback = (handle) => window.clearTimeout(handle);
  }
}

function installMediaQueryListeners(): void {
  if (typeof window.matchMedia !== "function") return;
  const media = window.matchMedia("all");
  const prototype = Object.getPrototypeOf(media) as MediaQueryList;

  if (typeof prototype.addEventListener !== "function") {
    Object.defineProperty(prototype, "addEventListener", {
      configurable: true,
      value(_type: string, listener: EventListenerOrEventListenerObject) {
        this.addListener(listener as (event: MediaQueryListEvent) => void);
      },
    });
  }
  if (typeof prototype.removeEventListener !== "function") {
    Object.defineProperty(prototype, "removeEventListener", {
      configurable: true,
      value(_type: string, listener: EventListenerOrEventListenerObject) {
        this.removeListener(listener as (event: MediaQueryListEvent) => void);
      },
    });
  }
}

function installClipboardFallback(): void {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") return;

  const writeText = (text: string): Promise<void> => {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, field.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      document.body.removeChild(field);
    }
    return copied
      ? Promise.resolve()
      : Promise.reject(new Error("El navegador no permitió copiar el texto."));
  };

  try {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  } catch {
    // Some managed iPads expose Navigator as non-configurable. Copy buttons can
    // still show their existing error without stopping the rest of the app.
  }
}

class LegacyResizeObserver {
  private readonly callback: ResizeObserverCallback;
  private readonly dimensions = new Map<Element, string>();
  private timer: number | null = null;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    this.dimensions.set(target, "");
    this.start();
    this.measure();
  }

  unobserve(target: Element): void {
    this.dimensions.delete(target);
    if (this.dimensions.size === 0) this.stop();
  }

  disconnect(): void {
    this.dimensions.clear();
    this.stop();
  }

  private start(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.measure(), 250);
  }

  private stop(): void {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }

  private measure(): void {
    const entries: ResizeObserverEntry[] = [];
    this.dimensions.forEach((previous, target) => {
      const contentRect = target.getBoundingClientRect();
      const next = `${contentRect.width}:${contentRect.height}`;
      if (previous === next) return;
      this.dimensions.set(target, next);
      entries.push({ target, contentRect } as ResizeObserverEntry);
    });
    if (entries.length > 0) {
      this.callback(entries, this as unknown as ResizeObserver);
    }
  }
}

function installResizeObserver(): void {
  if (typeof window.ResizeObserver === "function") return;
  window.ResizeObserver = LegacyResizeObserver as unknown as typeof ResizeObserver;
}

function isLegacySafari(): boolean {
  const agent = navigator.userAgent;
  const iosMatch = agent.match(/OS (\d+)[_.]/);
  if (/iPad|iPhone|iPod/.test(agent) && iosMatch) {
    return Number(iosMatch[1]) <= 12;
  }
  const safariMatch = agent.match(/Version\/(\d+).+Safari/);
  return Boolean(safariMatch && Number(safariMatch[1]) <= 12);
}

function supportsFlexGap(): boolean {
  const flex = document.createElement("div");
  flex.style.display = "flex";
  flex.style.flexDirection = "column";
  flex.style.rowGap = "1px";
  flex.appendChild(document.createElement("div"));
  flex.appendChild(document.createElement("div"));
  const testHost = document.body || document.documentElement;
  testHost.appendChild(flex);
  const supported = flex.scrollHeight === 1;
  testHost.removeChild(flex);
  return supported;
}

function enableLegacyVisualMode(): void {
  if (!isLegacySafari()) return;

  const root = document.documentElement;
  root.classList.add("albatros-legacy-safari");
  if (!supportsFlexGap()) root.classList.add("albatros-no-flex-gap");
  if (!window.CSS?.supports?.("aspect-ratio", "1 / 1")) {
    root.classList.add("albatros-no-aspect-ratio");
  }

  const updateViewport = () => {
    root.style.setProperty("--albatros-vh", `${window.innerHeight * 0.01}px`);
  };
  updateViewport();
  window.addEventListener("resize", updateViewport, { passive: true });
  window.addEventListener("orientationchange", updateViewport);

  const style = document.createElement("style");
  style.id = "albatros-legacy-safari-styles";
  style.textContent = `
    html.albatros-legacy-safari { scroll-behavior: auto !important; }
    html.albatros-legacy-safari body {
      -webkit-text-size-adjust: 100%;
      min-height: calc(var(--albatros-vh, 1vh) * 100);
    }
    html.albatros-legacy-safari [class*="backdrop-blur"] {
      -webkit-backdrop-filter: none !important;
      backdrop-filter: none !important;
    }
    html.albatros-legacy-safari [class~="min-h-screen"],
    html.albatros-legacy-safari [class~="min-h-[100svh]"],
    html.albatros-legacy-safari [class~="min-h-[100dvh]"] {
      min-height: calc(var(--albatros-vh, 1vh) * 100) !important;
    }
    html.albatros-legacy-safari [class~="max-h-[90dvh]"] { max-height: 90vh !important; }
    html.albatros-legacy-safari [class~="max-h-[65dvh]"] { max-height: 65vh !important; }
    html.albatros-legacy-safari [class~="max-h-[88vh]"] { max-height: 88vh !important; }
    html.albatros-legacy-safari .dojang-fullscreen {
      height: calc(var(--albatros-vh, 1vh) * 100) !important;
      min-height: calc(var(--albatros-vh, 1vh) * 100) !important;
    }
    html.albatros-legacy-safari [class~="sticky"] {
      position: -webkit-sticky;
      position: sticky;
    }
    html.albatros-legacy-safari [class~="inset-0"] {
      top: 0; right: 0; bottom: 0; left: 0;
    }
    html.albatros-legacy-safari [class~="inset-x-0"] { right: 0; left: 0; }
    html.albatros-legacy-safari [class~="inset-y-0"] { top: 0; bottom: 0; }

    html.albatros-no-flex-gap .flex[class*="gap-"] {
      --albatros-gap-x: 0px;
      --albatros-gap-y: 0px;
      margin-right: calc(-1 * var(--albatros-gap-x));
      margin-bottom: calc(-1 * var(--albatros-gap-y));
    }
    html.albatros-no-flex-gap .flex[class*="gap-"] > * {
      margin-right: var(--albatros-gap-x);
      margin-bottom: var(--albatros-gap-y);
    }
    html.albatros-no-flex-gap .flex.flex-col[class*="gap-"] {
      margin-right: 0;
    }
    html.albatros-no-flex-gap .flex.flex-col[class*="gap-"] > * {
      margin-right: 0;
    }
    html.albatros-no-flex-gap .flex[class~="gap-px"] { --albatros-gap-x: 1px; --albatros-gap-y: 1px; }
    html.albatros-no-flex-gap .flex[class~="gap-0"] { --albatros-gap-x: 0px; --albatros-gap-y: 0px; }
    html.albatros-no-flex-gap .flex[class~="gap-0.5"] { --albatros-gap-x: .125rem; --albatros-gap-y: .125rem; }
    html.albatros-no-flex-gap .flex[class~="gap-1"] { --albatros-gap-x: .25rem; --albatros-gap-y: .25rem; }
    html.albatros-no-flex-gap .flex[class~="gap-1.5"] { --albatros-gap-x: .375rem; --albatros-gap-y: .375rem; }
    html.albatros-no-flex-gap .flex[class~="gap-2"] { --albatros-gap-x: .5rem; --albatros-gap-y: .5rem; }
    html.albatros-no-flex-gap .flex[class~="gap-2.5"] { --albatros-gap-x: .625rem; --albatros-gap-y: .625rem; }
    html.albatros-no-flex-gap .flex[class~="gap-3"] { --albatros-gap-x: .75rem; --albatros-gap-y: .75rem; }
    html.albatros-no-flex-gap .flex[class~="gap-4"] { --albatros-gap-x: 1rem; --albatros-gap-y: 1rem; }
    html.albatros-no-flex-gap .flex[class~="gap-5"] { --albatros-gap-x: 1.25rem; --albatros-gap-y: 1.25rem; }
    html.albatros-no-flex-gap .flex[class~="gap-6"] { --albatros-gap-x: 1.5rem; --albatros-gap-y: 1.5rem; }
    html.albatros-no-flex-gap .flex[class~="gap-7"] { --albatros-gap-x: 1.75rem; --albatros-gap-y: 1.75rem; }
    html.albatros-no-flex-gap .flex[class~="gap-8"] { --albatros-gap-x: 2rem; --albatros-gap-y: 2rem; }
    html.albatros-no-flex-gap .flex[class~="gap-16"] { --albatros-gap-x: 4rem; --albatros-gap-y: 4rem; }
    html.albatros-no-flex-gap .flex[class~="gap-x-2"] { --albatros-gap-x: .5rem; }
    html.albatros-no-flex-gap .flex[class~="gap-x-4"] { --albatros-gap-x: 1rem; }
    html.albatros-no-flex-gap .flex[class~="gap-x-5"] { --albatros-gap-x: 1.25rem; }
    html.albatros-no-flex-gap .flex[class~="gap-y-1"] { --albatros-gap-y: .25rem; }
    html.albatros-no-flex-gap .flex[class~="gap-y-2"] { --albatros-gap-y: .5rem; }
    html.albatros-no-flex-gap .flex[class~="gap-y-4"] { --albatros-gap-y: 1rem; }
    @media (min-width: 640px) {
      html.albatros-no-flex-gap .flex[class~="sm:gap-0"] { --albatros-gap-x: 0px; --albatros-gap-y: 0px; }
      html.albatros-no-flex-gap .flex[class~="sm:gap-2"] { --albatros-gap-x: .5rem; --albatros-gap-y: .5rem; }
      html.albatros-no-flex-gap .flex[class~="sm:gap-4"] { --albatros-gap-x: 1rem; --albatros-gap-y: 1rem; }
      html.albatros-no-flex-gap .flex[class~="sm:gap-5"] { --albatros-gap-x: 1.25rem; --albatros-gap-y: 1.25rem; }
      html.albatros-no-flex-gap .flex[class~="sm:gap-6"] { --albatros-gap-x: 1.5rem; --albatros-gap-y: 1.5rem; }
    }
    @media (min-width: 768px) {
      html.albatros-no-flex-gap .flex[class~="md:gap-3"] { --albatros-gap-x: .75rem; --albatros-gap-y: .75rem; }
      html.albatros-no-flex-gap .flex[class~="md:gap-4"] { --albatros-gap-x: 1rem; --albatros-gap-y: 1rem; }
      html.albatros-no-flex-gap .flex[class~="md:gap-5"] { --albatros-gap-x: 1.25rem; --albatros-gap-y: 1.25rem; }
      html.albatros-no-flex-gap .flex[class~="md:gap-24"] { --albatros-gap-x: 6rem; --albatros-gap-y: 6rem; }
    }
    @media (min-width: 1024px) {
      html.albatros-no-flex-gap .flex[class~="lg:gap-3"] { --albatros-gap-x: .75rem; --albatros-gap-y: .75rem; }
      html.albatros-no-flex-gap .flex[class~="lg:gap-5"] { --albatros-gap-x: 1.25rem; --albatros-gap-y: 1.25rem; }
      html.albatros-no-flex-gap .flex[class~="lg:gap-10"] { --albatros-gap-x: 2.5rem; --albatros-gap-y: 2.5rem; }
    }
    @media (min-width: 1280px) {
      html.albatros-no-flex-gap .flex[class~="xl:gap-6"] { --albatros-gap-x: 1.5rem; --albatros-gap-y: 1.5rem; }
    }

    html.albatros-no-aspect-ratio [class~="aspect-square"]::before,
    html.albatros-no-aspect-ratio [class~="aspect-video"]::before,
    html.albatros-no-aspect-ratio [class~="aspect-[4/3]"]::before,
    html.albatros-no-aspect-ratio [class~="aspect-[4/5]"]::before,
    html.albatros-no-aspect-ratio [class~="aspect-[9/16]"]::before,
    html.albatros-no-aspect-ratio [class~="aspect-[1.414/1]"]::before {
      content: "";
      display: block;
      float: left;
      width: 1px;
    }
    html.albatros-no-aspect-ratio [class~="aspect-square"]::before { padding-top: 100%; }
    html.albatros-no-aspect-ratio [class~="aspect-video"]::before { padding-top: 56.25%; }
    html.albatros-no-aspect-ratio [class~="aspect-[4/3]"]::before { padding-top: 75%; }
    html.albatros-no-aspect-ratio [class~="aspect-[4/5]"]::before { padding-top: 125%; }
    html.albatros-no-aspect-ratio [class~="aspect-[9/16]"]::before { padding-top: 177.7778%; }
    html.albatros-no-aspect-ratio [class~="aspect-[1.414/1]"]::before { padding-top: 70.7214%; }
    html.albatros-no-aspect-ratio [class~="aspect-square"]::after,
    html.albatros-no-aspect-ratio [class~="aspect-video"]::after,
    html.albatros-no-aspect-ratio [class*="aspect-["]::after {
      content: "";
      display: table;
      clear: both;
    }
    html.albatros-legacy-safari *,
    html.albatros-legacy-safari *::before,
    html.albatros-legacy-safari *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
    }
  `;
  document.head.appendChild(style);
}

installStringReplaceAll();
installArrayAt();
installObjectFromEntries();
installPromiseAllSettled();
installRandomUuid();
installQueueMicrotask();
installIdleCallbacks();
installMediaQueryListeners();
installClipboardFallback();
installResizeObserver();
enableLegacyVisualMode();
