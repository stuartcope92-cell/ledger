// Progress photos live in a private Supabase Storage bucket, so displaying
// one needs a signed URL rather than a local blob: URL — same "render an
// image from an async source" shape as useObjectUrl (used for a photo still
// pending upload), just backed by Storage instead of a local Blob.
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export function useSignedPhotoUrl(storagePath: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!storagePath) {
      setUrl(undefined);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from("progress-photos")
      .createSignedUrl(storagePath, 60 * 60) // 1 hour — plenty for a single view
      .then(({ data, error }) => {
        if (!cancelled && !error && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return url;
}
