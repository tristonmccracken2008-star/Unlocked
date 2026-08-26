"use client";

import { ApplicationPacketUnavailable } from "@/components/application-packet";

export default function Error({ reset }: { reset: () => void }) {
  return <ApplicationPacketUnavailable onRetry={reset} />;
}
