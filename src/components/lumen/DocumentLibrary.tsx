import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { PageHeader, Panel } from "./common";
import { DocumentDetails, DocumentStatus } from "./DocumentDetails";
import { listDocuments, type ApiDocument } from "@/lib/lumen/documents-api";

export function DocumentLibrary({ initialQuery = "" }: { initialQuery?: string }) {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(initialQuery);
  const [family, setFamily] = useState<string | null>(null);
  const [classification, setClassification] = useState<string | null>(null);
  const [grid, setGrid] = useState(false);
  const [viewed, setViewed] = useState<string | null>(null);
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const records = await listDocuments();
      setDocuments(
        records.filter(
          (document) =>
            document.is_active &&
            document.current_approved_version &&
            ["APPROVED_CURRENT", "RELEASED"].includes(document.current_approved_version.status),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the document library.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const families = [
    ...new Map(
      documents.map((document) => [
        document.family_id,
        { value: document.family_id, label: document.family_name },
      ]),
    ).values(),
  ];
  const filtered = documents.filter(
    (document) =>
      (!query ||
        `${document.title} ${document.reference}`.toLowerCase().includes(query.toLowerCase())) &&
      (!family || document.family_id === family) &&
      (!classification || document.classification === classification),
  );
  return (
    <>
      <PageHeader
        crumb="Document Library"
        title="Document Library"
        description="The current approved documents you are authorised to view."
      />
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          {filtered.length} documents
        </Text>
        <Group>
          <Button variant="default" onClick={() => setGrid((value) => !value)}>
            {grid ? "Table view" : "Grid view"}
          </Button>
          <Button variant="default" disabled={loading} onClick={() => void refresh()}>
            Refresh
          </Button>
        </Group>
      </Group>
      <Panel>
        <Stack p="md">
          <Group align="end">
            <TextInput
              label="Search title or reference"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              label="Family"
              clearable
              placeholder="All families"
              data={families}
              value={family}
              onChange={setFamily}
            />
            <Select
              label="Classification"
              clearable
              placeholder="D2 / D3"
              data={["D2", "D3"]}
              value={classification}
              onChange={setClassification}
            />
          </Group>
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          {loading ? (
            <Group role="status">
              <Loader size="sm" />
              <Text>Loading permitted documents…</Text>
            </Group>
          ) : (
            !error &&
            (filtered.length === 0 ? (
              <Text p="xl" ta="center" c="dimmed">
                No permitted approved documents match your filters.
              </Text>
            ) : grid ? (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                {filtered.map((document) => (
                  <Panel key={document._id}>
                    <Stack p="md">
                      <Text fw={600}>{document.title}</Text>
                      <Text size="sm">{document.reference}</Text>
                      <Text size="sm">
                        {document.family_name} · v
                        {document.current_approved_version!.version_number}
                      </Text>
                      <DocumentStatus status="APPROVED_CURRENT" />
                      <Button
                        onClick={() =>
                          void navigate({ to: "/d/$id", params: { id: document._id } })
                        }
                      >
                        View document
                      </Button>
                    </Stack>
                  </Panel>
                ))}
              </SimpleGrid>
            ) : (
              <Table.ScrollContainer minWidth={800}>
                <Table verticalSpacing="md">
                  <Table.Thead>
                    <Table.Tr>
                      {[
                        "Title",
                        "Reference",
                        "Family",
                        "Version",
                        "Classification",
                        "Status",
                        "Actions",
                      ].map((label) => (
                        <Table.Th key={label}>{label}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filtered.map((document) => (
                      <Table.Tr key={document._id}>
                        <Table.Td>{document.title}</Table.Td>
                        <Table.Td>{document.reference}</Table.Td>
                        <Table.Td>{document.family_name}</Table.Td>
                        <Table.Td>{document.current_approved_version!.version_number}</Table.Td>
                        <Table.Td>{document.classification}</Table.Td>
                        <Table.Td>
                          <DocumentStatus status="APPROVED_CURRENT" />
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant="subtle"
                              onClick={() => setViewed(document._id)}
                            >
                              Details
                            </Button>
                            <Button
                              size="xs"
                              onClick={() =>
                                void navigate({ to: "/d/$id", params: { id: document._id } })
                              }
                            >
                              View
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ))
          )}
        </Stack>
      </Panel>
      <Modal
        opened={viewed !== null}
        onClose={() => setViewed(null)}
        title="Document details"
        size="xl"
        centered
      >
        {viewed && <DocumentDetails key={viewed} documentId={viewed} />}
      </Modal>
    </>
  );
}
