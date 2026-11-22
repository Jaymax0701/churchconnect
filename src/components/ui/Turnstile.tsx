import { useEffect, useRef, useState } from "react";

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoader: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileLoader) return turnstileLoader;

  const loader = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );

    const script = existingScript ?? document.createElement("script");
    const handleLoad = () => {
      if (window.turnstile) resolve();
      else reject(new Error("Cloudflare Turnstile did not initialise."));
    };
    const handleError = () => reject(new Error("Unable to load Cloudflare Turnstile."));

    if (existingScript) {
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      if (window.turnstile) resolve();
    } else {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    turnstileLoader = null;
    throw error;
  });

  turnstileLoader = loader;
  return loader;
}

interface TurnstileProps {
  onToken: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
}

export function Turnstile({
  onToken,
  onError,
  onExpire,
  theme = "auto",
  size = "normal",
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const callbacksRef = useRef({ onToken, onError, onExpire });
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const configurationError = !siteKey
    ? "Turnstile is not configured. Please contact the site administrator."
    : null;

  useEffect(() => {
    callbacksRef.current = { onToken, onError, onExpire };
  }, [onToken, onError, onExpire]);

  useEffect(() => {
    let active = true;
    let widgetId: string | undefined;

    if (!siteKey) {
      callbacksRef.current.onError?.();
      return;
    }

    void loadTurnstile()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size,
          callback: (token) => {
            if (active) callbacksRef.current.onToken(token);
          },
          "error-callback": () => {
            if (!active) return;
            callbacksRef.current.onToken("");
            callbacksRef.current.onError?.();
          },
          "expired-callback": () => {
            if (!active) return;
            callbacksRef.current.onToken("");
            callbacksRef.current.onExpire?.();
          },
        });
      })
      .catch(() => {
        if (!active) return;
        setLoadError("Unable to load the security check. Please refresh the page and try again.");
        callbacksRef.current.onError?.();
      });

    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, theme, size]);

  return (
    <div>
      <div ref={containerRef} />
      {(configurationError || loadError) && (
        <p role="alert" style={{ color: "var(--color-danger, #b42318)", fontSize: "var(--text-xs)" }}>
          {configurationError || loadError}
        </p>
      )}
    </div>
  );
}
