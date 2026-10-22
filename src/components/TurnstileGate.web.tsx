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
    script.addEventListener(
      "error",
      () => {
        script.remove();
        reject(new Error("Turnstile unavailable"));
      },
      {
        once: true,
      },
    );
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
  const [message, setMessage] = useState("Preparing search…");

  useEffect(() => {
    let active = true;
    const element = host.current;
    const sitekey = aiRuntimeConfiguration.turnstileSiteKey;
    if (aiRuntimeConfiguration.fixtureMode) {
      onTokenChange("local-browser-acceptance-fixture");
      setMessage("");
      return;
    }
    if (!element || !aiRuntimeConfiguration.configured || !sitekey) {
      onTokenChange(null);
      setMessage("");
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
            setMessage("");
          },
          "error-callback": () => {
            onTokenChange(null);
            setMessage("Please try the verification again, or choose word filters below.");
          },
          "expired-callback": () => {
            onTokenChange(null);
            setMessage("Please complete the verification again.");
          },
          "timeout-callback": () => {
            onTokenChange(null);
            setMessage("Please try the verification again, or choose word filters below.");
          },
          theme: "auto",
        });
      })
      .catch(() => {
        if (!active) return;
        onTokenChange(null);
        setMessage("Search couldn't get ready. Please try again or choose word filters below.");
      });
    return () => {
      active = false;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [onTokenChange]);

  useEffect(() => {
    if (aiRuntimeConfiguration.fixtureMode) {
      onTokenChange("local-browser-acceptance-fixture");
      setMessage("");
      return;
    }
    if (!widgetId.current || !window.turnstile || resetNonce === 0) return;
    onTokenChange(null);
    setMessage("Preparing search…");
    window.turnstile.reset(widgetId.current);
  }, [onTokenChange, resetNonce]);

  return (
    <View style={{ gap: spacing.xs }}>
      <div aria-label="Cloudflare Turnstile" ref={host} />
      <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 15 }}>
        {message}
      </Text>
    </View>
  );
}
