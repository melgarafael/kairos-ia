"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

export function Analytics() {
  useEffect(() => {
    if (!key) return;
    posthog.init(key, {
      api_host: host ?? "https://app.posthog.com",
      capture_pageview: true
    });
  }, []);

  return null;
}

