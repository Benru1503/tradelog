"use client";

import { useEffect } from "react";
import { captureTimezone } from "@/app/(app)/actions";

export function TimezoneCapture() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) void captureTimezone(tz);
    } catch {
      // Browser without Intl support — skip.
    }
  }, []);
  return null;
}
