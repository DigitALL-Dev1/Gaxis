import { useEffect, useState } from "react";
import { Alert, Button, Loader, Stack, Text } from "@mantine/core";
import { getDocumentFile, type ApiDocumentVersion } from "@/lib/lumen/documents-api";

export function DocumentFilePreview({ version }: { version: ApiDocumentVersion }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setLoading(true);
    setError("");
    setUrl("");
    void getDocumentFile(version._id)
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Unable to load the uploaded file.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [version._id, attempt]);
  return (
    <Stack gap="sm">
      {loading && <Loader aria-label="Loading document file" size="sm" />}
      {error && (
        <>
          <Alert color="red" role="alert">
            {error}
          </Alert>
          <Button variant="default" onClick={() => setAttempt((value) => value + 1)}>
            Retry file
          </Button>
        </>
      )}
      {url && (
        <>
          {version.file_type === "application/pdf" ? (
            <iframe
              title="Document preview"
              src={url}
              style={{ width: "100%", height: 480, border: 0 }}
            />
          ) : (
            <Text>Download this Word document to review its contents.</Text>
          )}
          <Button component="a" href={url} download={version.file_name} variant="light">
            Download {version.file_name}
          </Button>
        </>
      )}
    </Stack>
  );
}
