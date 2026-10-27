import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Alert,
  Button,
  Checkbox,
  FileInput,
  Group,
  Loader,
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { toast } from "sonner";
import { PageHeader, Panel } from "./common";
import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { useUserAuth } from "@/lib/lumen/user-auth";
import {
  loadActiveDocumentFamilies,
  type ApiDocumentFamily,
} from "@/lib/lumen/document-families-api";
import { listReaderClasses, type ApiReaderClass } from "@/lib/lumen/reader-classes-api";
import { listUsers, type ApiUser } from "@/lib/lumen/users-api";
import {
  DOCUMENT_TYPES,
  prepareDocument,
  uploadDocumentRevision,
  validateDocumentFile,
  type ApiDocument,
  type PreparedResponse,
} from "@/lib/lumen/documents-api";

export function DocumentUploadForm({
  document,
  onSaved,
  onBusyChange,
}: {
  document?: ApiDocument;
  onSaved: (result: PreparedResponse) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const user = useUserAuth((state) => state.user);
  const admin = useAdminAuth((state) => state.admin);
  const [families, setFamilies] = useState<ApiDocumentFamily[]>([]);
  const [classes, setClasses] = useState<ApiReaderClass[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [duplicateReference, setDuplicateReference] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(document?.title ?? "");
  const [reference, setReference] = useState(document?.reference ?? "");
  const [familyId, setFamilyId] = useState<string | null>(document?.family_id ?? null);
  const [classification, setClassification] = useState<string | null>(
    document?.classification ?? "D2",
  );
  const [readerIds, setReaderIds] = useState<string[]>(document?.reader_class_ids ?? []);
  const [version, setVersion] = useState(document ? "" : "1.0");
  const [acknowledge, setAcknowledge] = useState(document?.acknowledgement_required ?? true);
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const canSubmit = !!admin || !!user?.permissions.includes("documents.submit");

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [familyData, classData, userData] = await Promise.all([
        loadActiveDocumentFamilies(),
        listReaderClasses(),
        admin ? listUsers() : Promise.resolve([]),
      ]);
      setFamilies(
        familyData.filter(
          (family) =>
            family.is_active &&
            family.owner_user_id &&
            (admin || family.owner_user_id === user?.id),
        ),
      );
      setClasses(classData.filter((reader) => reader.is_active));
      setUsers(userData);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Unable to load preparation options.");
    } finally {
      setLoading(false);
    }
  }, [admin, user?.id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const selectedFamily = families.find((family) => family._id === familyId);
  const ownerId = admin ? selectedFamily?.owner_user_id : user?.id;
  const ownerName = admin
    ? (users.find((entry) => entry._id === ownerId)?.full_name ??
      "Select a family with an active owner")
    : (user?.full_name ?? "");

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving || loading) return;
        setError("");
        setDuplicateReference(false);
        if (!canSubmit) {
          setError("Submitting for approval requires documents.submit permission.");
          return;
        }
        if (
          !title.trim() ||
          reference.trim().length < 5 ||
          !selectedFamily ||
          !ownerId ||
          !readerIds.length ||
          !["D2", "D3"].includes(classification ?? "") ||
          !/^\d+(?:\.\d+)*$/.test(version.trim())
        ) {
          setError(
            "Enter a title, reference, assigned family, reader classes and a numeric version number.",
          );
          return;
        }
        if (document && !summary.trim()) {
          setError("A change summary is required for a revised version.");
          return;
        }
        const fileError = validateDocumentFile(file);
        if (fileError) {
          setError(fileError);
          return;
        }
        const body = new FormData();
        body.append("owner_user_id", ownerId);
        body.append("version_number", version.trim());
        body.append("change_summary", summary.trim());
        body.append("file", file!);
        body.append("title", title.trim());
        body.append("classification", classification!);
        body.append("reader_class_ids", readerIds.join(","));
        body.append("acknowledgement_required", String(acknowledge));
        if (!document) {
          body.append("reference", reference.trim().toUpperCase());
          body.append("family_id", selectedFamily._id);
        }
        setSaving(true);
        onBusyChange?.(true);
        try {
          const result = document
            ? await uploadDocumentRevision(document._id, body)
            : await prepareDocument(body);
          toast.success("Document submitted for approval", { description: "Under Review" });
          onSaved(result);
        } catch (cause) {
          const detail = cause instanceof Error ? cause.message : "Unable to upload the document.";
          setError(detail);
          setDuplicateReference(!document && /reference.*already exists/i.test(detail));
        } finally {
          setSaving(false);
          onBusyChange?.(false);
        }
      }}
    >
      <Stack>
        {loadError && (
          <Alert color="red" role="alert">
            {loadError}
          </Alert>
        )}
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        {duplicateReference && (
          <Alert color="orange" title="This reference belongs to an existing document">
            <Stack gap="sm">
              <Text size="sm">
                To revise this document, open My Prepared Documents and choose Upload revised
                version or Correct and resubmit. Use a new version number and a change summary. If a
                version is already under review, wait for its review first. For a separate new
                document, enter a unique reference.
              </Text>
              <Button component={Link} to="/admin/prepared" variant="light">
                Open My Prepared Documents
              </Button>
            </Stack>
          </Alert>
        )}
        {!canSubmit && (
          <Alert color="yellow">
            You can prepare documents, but submission requires documents.submit permission.
          </Alert>
        )}
        {loading ? (
          <Group role="status">
            <Loader size="sm" />
            <Text>Loading assigned families and reader classes…</Text>
          </Group>
        ) : (
          <>
            {!loadError && families.length === 0 && (
              <Alert color="yellow">
                No active document families are assigned to you. Ask an administrator to assign a
                Document Owner.
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="subtle" disabled={saving} onClick={() => void refresh()}>
                Refresh options
              </Button>
            </Group>
            <TextInput
              label="Document title"
              name="title"
              required
              value={title}
              disabled={saving}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
            <TextInput
              label="Document reference"
              name="reference"
              required
              minLength={5}
              value={reference}
              disabled={saving || !!document}
              error={duplicateReference ? "Document references must be unique." : undefined}
              onChange={(event) => {
                setReference(event.currentTarget.value);
                if (duplicateReference) {
                  setDuplicateReference(false);
                  setError("");
                }
              }}
            />
            <Select
              label="Document family"
              required
              data={families.map((family) => ({ value: family._id, label: family.family_name }))}
              value={familyId}
              onChange={setFamilyId}
              disabled={saving || !!document}
            />
            <TextInput
              label="Document owner"
              value={ownerName}
              readOnly
              description="The assigned family owner prepares and submits this document."
            />
            <Select
              label="Classification"
              required
              data={["D2", "D3"]}
              value={classification}
              onChange={setClassification}
              disabled={saving}
            />
            <MultiSelect
              label="Reader classes"
              required
              searchable
              data={classes.map((reader) => ({ value: reader._id, label: reader.class_name }))}
              value={readerIds}
              onChange={setReaderIds}
              disabled={saving}
            />
            <TextInput
              label="Version number"
              name="version_number"
              required
              placeholder={document ? "e.g. 2.0" : "e.g. 1.0"}
              value={version}
              disabled={saving}
              onChange={(event) => setVersion(event.currentTarget.value)}
            />
            <Checkbox
              label="Acknowledgement required"
              checked={acknowledge}
              disabled={saving}
              onChange={(event) => setAcknowledge(event.currentTarget.checked)}
            />
            <Textarea
              label="Change summary"
              name="change_summary"
              required={!!document}
              rows={3}
              value={summary}
              disabled={saving}
              onChange={(event) => setSummary(event.currentTarget.value)}
            />
            <FileInput
              label="Upload document"
              description="PDF, DOCX or DOC. Maximum 100 MB."
              accept={DOCUMENT_TYPES}
              required
              value={file}
              onChange={setFile}
              disabled={saving}
            />
            <Text size="xs" c="dimmed">
              A different authorised releaser must approve the uploaded version. The current
              approved version stays available during review.
            </Text>
            <Button
              type="submit"
              loading={saving}
              disabled={!!loadError || !canSubmit || !selectedFamily}
            >
              {saving ? "Uploading document…" : "Submit for Approval"}
            </Button>
          </>
        )}
      </Stack>
    </form>
  );
}

export function PrepareDocument() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        crumb="Publishing / Prepare"
        title="Prepare Document"
        description="Upload a document for independent review and release."
      />
      <Panel>
        <div className="p-6">
          <DocumentUploadForm onSaved={() => void navigate({ to: "/admin/prepared" })} />
        </div>
      </Panel>
      <Group mt="lg">
        <Button component={Link} to="/admin/prepared" variant="light">
          My Prepared Documents
        </Button>
      </Group>
    </>
  );
}
