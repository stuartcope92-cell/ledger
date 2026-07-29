// Renders a Blob as an <img src>, revoking the object URL on cleanup so
// repeated renders (photo timeline, comparisons) don't leak memory.
import { useEffect, useState } from "react";

export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url;
}
