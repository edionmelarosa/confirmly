"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong on our end.</h2>
        <p>The error has been reported. Please try again.</p>
        <button onClick={() => retry()}>Try again</button>
      </body>
    </html>
  );
}
