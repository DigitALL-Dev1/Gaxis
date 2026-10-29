import { useCallback, useEffect, useState } from "react";
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
import {
  loadActiveDocumentFamilies,
  type ApiDocumentFamily,
} from "@/lib/lumen/document-families-api";
import { listReaderClasses, type ApiReaderClass } from "@/lib/lumen/reader-classes-api";
import { getDocument, type ApiDocument } from "@/lib/lumen/documents-api";
import {
  listMedia,
  prepareMedia,
  validateMediaFile,
  type MediaAsset,
  type MediaLicence,
  type MediaType,
} from "@/lib/lumen/media-api";
import { useUserAuth } from "@/lib/lumen/user-auth";

const LICENCE_OPTIONS: { value: MediaLicence; label: string }[] = [
  { value: "OWNED", label: "Owned by GREEN" },
  { value: "LICENSED_WITH_REFERENCE", label: "Licensed (evidence required)" },
  { value: "PERMISSION_GRANTED", label: "Permission granted (evidence required)" },
  { value: "REFERENCE_ONLY", label: "External reference only" },
];

export function MediaPreparation() {
  const user = useUserAuth((state) => state.user);
  const [families, setFamilies] = useState<ApiDocumentFamily[]>([]);
  const [classes, setClasses] = useState<ApiReaderClass[]>([]);
  const [existingMedia, setExistingMedia] = useState<MediaAsset[]>([]);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [classification, setClassification] = useState<string | null>("D2");
  const [readerIds, setReaderIds] = useState<string[]>([]);
  const [version, setVersion] = useState("1.0");
  const [mediaType, setMediaType] = useState<MediaType>("VIDEO");
  const [licence, setLicence] = useState<MediaLicence>("OWNED");
  const [licenceReference, setLicenceReference] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [description, setDescription] = useState("");
  const [acknowledgementRequired, setAcknowledgementRequired] = useState(true);
  const [safetyOrInduction, setSafetyOrInduction] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const referenceOnly = licence === "REFERENCE_ONLY";

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [familyData, classData, mediaData] = await Promise.all([
        loadActiveDocumentFamilies(),
        listReaderClasses(),
        listMedia(),
      ]);
      setFamilies(
        familyData.filter((family) => family.is_active && family.owner_user_id === user?.id),
      );
      setClasses(classData.filter((readerClass) => readerClass.is_active));
      setExistingMedia(
        mediaData.filter(
          (asset) =>
            asset.licence_status !== "REFERENCE_ONLY" &&
            ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"].includes(asset.processing_status),
        ),
      );
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : "Unable to load media preparation options.",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function selectExistingMedia(mediaId: string | null) {
    setError("");
    setDocumentId(null);
    if (!mediaId) {
      setTitle("");
      setReference("");
      setFamilyId(null);
      setClassification("D2");
      setReaderIds([]);
      setAcknowledgementRequired(true);
      setLicence("OWNED");
      setLicenceReference("");
      setExternalUrl("");
      setFile(null);
      return;
    }

    const asset = existingMedia.find((entry) => entry._id === mediaId);
    if (!asset) return;
    try {
      const document: ApiDocument = await getDocument(asset.document_id);
      setDocumentId(document._id);
      setTitle(document.title);
      setReference(document.reference);
      setFamilyId(document.family_id);
      setClassification(document.classification);
      setReaderIds(document.reader_class_ids);
      setAcknowledgementRequired(document.acknowledgement_required);
      setMediaType(asset.media_type);
      setLicence(asset.licence_status);
      setLicenceReference("");
      setExternalUrl("");
      setFile(null);
      setVersion("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load the controlled media item.",
      );
    }
  }

  return (
    <>
      <PageHeader
        crumb="Publishing / Media"
        title="Prepare Media"
        description="Submit video, audio or an external reference for controlled review and release."
      />
      <Panel>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving || loading) return;
            setError("");
            if (
              !title.trim() ||
              !/^\d+(?:\.\d+)*$/.test(version.trim()) ||
              !familyId ||
              !readerIds.length ||
              !["D2", "D3"].includes(classification ?? "") ||
              (!documentId && reference.trim().length < 5)
            ) {
              setError(
                "Enter a title, version, assigned family, reader classes, classification and a valid reference for a new item.",
              );
              return;
            }
            if (
              ["LICENSED_WITH_REFERENCE", "PERMISSION_GRANTED"].includes(licence) &&
              !licenceReference.trim()
            ) {
              setError("Licence evidence is required for this licence type.");
              return;
            }
            if (referenceOnly) {
              try {
                const url = new URL(externalUrl);
                if (url.protocol !== "https:" || url.username || url.password) throw new Error();
              } catch {
                setError("Enter a valid HTTPS reference URL.");
                return;
              }
              if (acknowledgementRequired) {
                setError("External reference media cannot require hosted acknowledgement.");
                return;
              }
            } else {
              const fileError = validateMediaFile(file, mediaType);
              if (fileError) {
                setError(fileError);
                return;
              }
            }

            const body = new FormData();
            body.append("title", title.trim());
            body.append("family_id", familyId);
            body.append("classification", classification!);
            body.append("reader_class_ids", readerIds.join(","));
            body.append("version_number", version.trim());
            body.append("media_type", mediaType);
            body.append("licence_status", licence);
            body.append("acknowledgement_required", String(acknowledgementRequired));
            if (documentId) body.append("document_id", documentId);
            else body.append("reference", reference.trim().toUpperCase());
            body.append("description", description.trim());
            body.append("safety_or_induction", String(safetyOrInduction));
            if (licenceReference.trim()) body.append("licence_reference", licenceReference.trim());
            if (referenceOnly) body.append("external_url", externalUrl.trim());
            if (file && !referenceOnly) body.append("file", file);

            setSaving(true);
            try {
              const result = await prepareMedia(body);
              toast.success("Media submitted for review", {
                description: `Processing: ${result.processing_status}`,
              });
              setTitle("");
              setReference("");
              setVersion("1.0");
              setDescription("");
              setFile(null);
              setDocumentId(null);
              setFamilyId(null);
              setReaderIds([]);
              try {
                setExistingMedia(await listMedia());
              } catch {
                toast.error("Media was submitted, but the revision list could not be refreshed.");
              }
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Unable to submit media.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <Stack p="md">
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
            {loading ? (
              <Group role="status">
                <Loader size="sm" />
                <Text>Loading assigned families and reader classes…</Text>
              </Group>
            ) : (
              <>
                {!loadError && families.length === 0 && (
                  <Alert color="yellow">
                    No active document families are assigned to you. Ask an administrator to assign
                    you as a family owner.
                  </Alert>
                )}
                <Select
                  label="Prepare a new item or revise existing media"
                  description="Choose an existing hosted media item to prepare a new version."
                  clearable
                  searchable
                  placeholder="New media item"
                  data={existingMedia.map((asset) => ({
                    value: asset._id,
                    label: `${asset.title} · ${asset.media_type}`,
                  }))}
                  value={
                    existingMedia.find((asset) => asset.document_id === documentId)?._id ?? null
                  }
                  onChange={(value) => void selectExistingMedia(value)}
                  disabled={saving}
                />
                <TextInput
                  label="Media title"
                  required
                  value={title}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  disabled={saving}
                />
                <TextInput
                  label="Controlled item reference"
                  description="Must be unique across the document library."
                  minLength={5}
                  value={reference}
                  onChange={(event) => setReference(event.currentTarget.value)}
                  disabled={saving || !!documentId}
                  required={!documentId}
                />
                <Select
                  label="Document family"
                  required
                  data={families.map((family) => ({
                    value: family._id,
                    label: family.family_name,
                  }))}
                  value={familyId}
                  onChange={setFamilyId}
                  disabled={saving || !!documentId}
                />
                <Group grow>
                  <Select
                    label="Classification"
                    required
                    data={["D2", "D3"]}
                    value={classification}
                    onChange={setClassification}
                    disabled={saving || !!documentId}
                  />
                  <MultiSelect
                    label="Reader classes"
                    required
                    searchable
                    data={classes.map((readerClass) => ({
                      value: readerClass._id,
                      label: readerClass.class_name,
                    }))}
                    value={readerIds}
                    onChange={setReaderIds}
                    disabled={saving || !!documentId}
                  />
                  <TextInput
                    label="Version number"
                    required
                    value={version}
                    onChange={(event) => setVersion(event.currentTarget.value)}
                    disabled={saving}
                  />
                </Group>
                <Group grow>
                  <Select
                    label="Media type"
                    data={[
                      { value: "VIDEO", label: "Video" },
                      { value: "AUDIO", label: "Audio" },
                    ]}
                    value={mediaType}
                    onChange={(value) => {
                      if (value === "VIDEO" || value === "AUDIO") setMediaType(value);
                    }}
                    disabled={saving || referenceOnly}
                  />
                  <Select
                    label="Licence status"
                    data={LICENCE_OPTIONS}
                    value={licence}
                    onChange={(value) => {
                      const selected = LICENCE_OPTIONS.find((option) => option.value === value);
                      if (selected) {
                        setLicence(selected.value);
                        if (selected.value === "REFERENCE_ONLY") setAcknowledgementRequired(false);
                      }
                    }}
                    disabled={saving}
                  />
                </Group>
                {licence !== "OWNED" && licence !== "REFERENCE_ONLY" && (
                  <TextInput
                    label="Licence evidence reference"
                    required
                    value={licenceReference}
                    onChange={(event) => setLicenceReference(event.currentTarget.value)}
                    disabled={saving}
                  />
                )}
                {referenceOnly ? (
                  <TextInput
                    label="External HTTPS URL"
                    type="url"
                    required
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.currentTarget.value)}
                    disabled={saving}
                  />
                ) : (
                  <FileInput
                    label="Media file"
                    description={`Video maximum 2 GB; audio maximum 200 MB. FFmpeg will process the uploaded file.`}
                    accept={mediaType === "VIDEO" ? "video/*" : "audio/*"}
                    required
                    value={file}
                    onChange={setFile}
                    disabled={saving}
                    clearable
                  />
                )}
                <Textarea
                  label="Description / change summary"
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.currentTarget.value)}
                  disabled={saving}
                />
                <Checkbox
                  label="Acknowledgement required"
                  checked={acknowledgementRequired}
                  onChange={(event) => setAcknowledgementRequired(event.currentTarget.checked)}
                  disabled={saving || referenceOnly}
                />
                <Checkbox
                  label="Safety or induction content"
                  checked={safetyOrInduction}
                  onChange={(event) => setSafetyOrInduction(event.currentTarget.checked)}
                  disabled={saving}
                />
                <Text size="sm" c="dimmed">
                  Video captions and transcript require human review. A separate authorised releaser
                  must approve media before it becomes available to readers.
                </Text>
                <Button type="submit" loading={saving} disabled={!!loadError || !familyId}>
                  {saving ? "Submitting media…" : "Submit for review"}
                </Button>
              </>
            )}
          </Stack>
        </form>
      </Panel>
    </>
  );
}
