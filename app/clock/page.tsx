"use client";

import RequireAuth from "@/components/RequireAuth";
import TimeClock from "@/components/kiosk/TimeClock";

export default function ClockPage() {
  return (
    <RequireAuth roles={["HR"]}>
      <TimeClock />
    </RequireAuth>
  );
}