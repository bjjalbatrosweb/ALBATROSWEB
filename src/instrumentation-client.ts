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

function enableLegacyVisualMode(): void {
  if (!isLegacySafari()) return;

  const root = document.documentElement;
  root.classList.add("albatros-legacy-safari");

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
