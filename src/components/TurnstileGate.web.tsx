import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { aiRuntimeConfiguration } from "../config/runtime";
import { colors, spacing } from "../theme/tokens";

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      theme: "auto";
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface Props {
  onTokenChange: (token: string | null) => void;
  resetNonce: number;
}

const SCRIPT_ID = "hkele-cloudflare-turnstile";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const finish = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable"));
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile unavailable")), {
      once: true,
    });
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

export function TurnstileGate({ onTokenChange, resetNonce }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const [message, setMessage] = useState("Preparing anti-abuse check…");

  useEffect(() => {
    let active = true;
    const element = host.current;
    const sitekey = aiRuntimeConfiguration.turnstileSiteKey;
    if (!element || !sitekey) {
      onTokenChange(null);
      setMessage("AI is not configured for this environment; manual filters remain available.");
      return;
    }
    void loadTurnstile()
      .then((api) => {
        if (!active || widgetId.current) return;
        widgetId.current = api.render(element, {
          sitekey,
          action: aiRuntimeConfiguration.turnstileAction,
          callback: (token) => {
            if (!active) return;
            onTokenChange(token);
            setMessage("Anti-abuse check ready for one AI request.");
          },
          "error-callback": () => {
            onTokenChange(null);
            setMessage("Anti-abuse check failed; use manual filters or try again.");
          },
          "expired-callback": () => {
            onTokenChange(null);
            setMessage("Anti-abuse check expired; a new check is required.");
          },
          "timeout-callback": () => {
            onTokenChange(null);
            setMessage("Anti-abuse check timed out; use manual filters or try again.");
          },
          theme: "auto",
        });
      })
      .catch(() => {
        if (!active) return;
        onTokenChange(null);
        setMessage("Anti-abuse check is unavailable; manual filters remain available.");
      });
    return () => {
      active = false;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [onTokenChange]);

  useEffect(() => {
    if (!widgetId.current || !window.turnstile || resetNonce === 0) return;
    onTokenChange(null);
    setMessage("Preparing a new anti-abuse check…");
    window.turnstile.reset(widgetId.current);
  }, [onTokenChange, resetNonce]);

  return (
    <View style={{ gap: spacing.xs }}>
      <div aria-label="Cloudflare Turnstile" ref={host} />
      <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 13 }}>
        {message}
      </Text>
    </View>
  );
}
