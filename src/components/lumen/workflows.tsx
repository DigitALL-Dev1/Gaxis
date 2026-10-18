import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Button,
  TextInput,
  Textarea,
  Select,
  MultiSelect,
  Checkbox,
  FileInput,
  Modal,
  Stack,
  Group,
  Table,
  Progress,
  SimpleGrid,
  Paper,
  Text,
  Badge,
  Tabs,
} from "@mantine/core";
import {
  IconUpload,
  IconPlus,
  IconPlayerPlay,
  IconHeadphones,
  IconDownload,
  IconShieldCheck,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PageHeader, Panel, StatusBadge, EmptyState, fmtDate } from "./common";
import { useLumen, daysBetween, grantStatus } from "@/lib/lumen/store";
import {
  FAMILIES,
  READER_CLASSES,
  ROLE_USERS,
  TEAM,
  MEDIA,
  type Doc,
  type Media,
  type Classification,
} from "@/lib/lumen/data";

export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <Table.ScrollContainer minWidth={720}>
      <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {headers.map((h, i) => (
              <Table.Th key={h + i}>{h}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{children}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function PrepareDocument() {
  const { prepare, docs } = useLumen();
  const [file, setFile] = useState<File | null>(null);
  const [readers, setReaders] = useState<string[]>(["All Staff"]);
  const [family, setFamily] = useState<string | null>(FAMILIES[0]!);
  const [classification, setClassification] = useState<string | null>("D2");
  const [ack, setAck] = useState(true);
  return (
    <>
      <PageHeader
        crumb="Publishing / Prepare"
        title="Prepare a document"
        description="Register a controlled document and submit it for independent release."
      />
      <Panel>
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const field = (key: string) => String(data.get(key) ?? "").trim();
            if (
              !file ||
              !family ||
              !classification ||
              !readers.length ||
              !field("title") ||
              !field("ref") ||
              !field("owner") ||
              !field("summary")
            ) {
              toast.error("Complete all required fields and attach a document.");
              return;
            }
            if (
              docs.some(
                (d) =>
                  d.ref.toLowerCase() === field("ref").toLowerCase() &&
                  d.version === field("version"),
              )
            ) {
              toast.error("This reference and version already exist.");
              return;
            }
            prepare({
              title: field("title"),
              ref: field("ref"),
              owner: field("owner"),
              version: field("version"),
              family,
              classification: classification as Classification,
              readerClasses: readers,
              ackRequired: ack,
              changeSummary: field("summary"),
              fileName: file.name,
            });
            form.reset();
            setFile(null);
            toast.success("Document submitted to the Release Queue.");
          }}
        >
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                name="title"
                label="Document title"
                required
                placeholder="e.g. Emergency Response Plan"
              />
              <TextInput
                name="ref"
                label="Document reference"
                required
                placeholder="GL-HS-PLN-012"
              />
              <Select
                label="Document family"
                data={FAMILIES}
                value={family}
                onChange={setFamily}
                required
              />
              <TextInput name="owner" label="Document owner" required />
              <Select
                label="Classification"
                data={[
                  "D2",
                  "D3",
                  { value: "D4", label: "D4 — unavailable in Release 1", disabled: true },
                ]}
                value={classification}
                onChange={setClassification}
                required
              />
              <TextInput
                name="version"
                label="Version"
                required
                pattern="[0-9]+(\.[0-9]+)*"
                defaultValue="1.0"
              />
            </SimpleGrid>
            <MultiSelect
              label="Reader classes"
              data={READER_CLASSES}
              value={readers}
              onChange={setReaders}
              required
            />
            <Textarea name="summary" label="Change summary" minRows={3} required />
            <Checkbox
              label="Acknowledgement required"
              checked={ack}
              onChange={(e) => setAck(e.currentTarget.checked)}
            />
            <FileInput
              label="Document file"
              description="The prototype stores the filename only; the reader displays sample content."
              value={file}
              onChange={setFile}
              required
              leftSection={<IconUpload size={16} />}
            />
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                A different person must approve this submission.
              </Text>
              <Button type="submit">Submit for release</Button>
            </Group>
          </Stack>
        </form>
      </Panel>
      <Group mt="lg">
        <Button component={Link} to="/admin/release" variant="light">
          View release queue
        </Button>
      </Group>
    </>
  );
}

export function ReleaseQueue() {
  const { docs, release, returnDoc } = useLumen();
  const [selected, setSelected] = useState<Doc | null>(null);
  const [mode, setMode] = useState<"details" | "release" | "return">("details");
  const [note, setNote] = useState("");
  const rows = docs.filter((d) => d.status === "Under Review");
  return (
    <>
      <PageHeader
        crumb="Publishing / Release"
        title="Release queue"
        description="Independently review submissions before making them available to readers."
      />
      <Panel>
        {!rows.length ? (
          <EmptyState title="You're up to date" text="No documents are awaiting release." />
        ) : (
          <DataTable
            headers={[
              "Document",
              "Reference / Version",
              "Prepared by",
              "Submitted",
              "Class",
              "Status",
              "Actions",
            ]}
          >
            {rows.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td fw={500}>{d.title}</Table.Td>
                <Table.Td>
                  {d.ref}
                  <Text size="xs" c="dimmed">
                    v{d.version}
                  </Text>
                </Table.Td>
                <Table.Td>{d.preparedBy}</Table.Td>
                <Table.Td>{d.submittedDate}</Table.Td>
                <Table.Td>{d.classification}</Table.Td>
                <Table.Td>
                  <StatusBadge status={d.status} />
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    {(
                      [
                        ["details", "Details"],
                        ["release", "Approve"],
                        ["return", "Return"],
                      ] as const
                    ).map(([m, label]) => (
                      <Button
                        size="xs"
                        variant={m === "release" ? "light" : "subtle"}
                        key={m}
                        onClick={() => {
                          setSelected(d);
                          setMode(m);
                          setNote("");
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <Modal
        opened={!!selected}
        onClose={() => setSelected(null)}
        title={
          mode === "release"
            ? "Approve and release?"
            : mode === "return"
              ? "Return for correction"
              : "Submission details"
        }
        centered
      >
        {selected && (
          <Stack>
            <Text fw={600}>
              {selected.title} · v{selected.version}
            </Text>
            <Text size="sm">{selected.changeSummary}</Text>
            <Text size="sm" c="dimmed">
              Owner: {selected.owner}
              <br />
              Reader classes: {selected.readerClasses.join(", ")}
              <br />
              File: {selected.fileName ?? "Sample document"}
            </Text>
            {mode === "release" && (
              <Text size="sm">
                This publishes the new version and supersedes any previously current version. The
                two-person rule applies.
              </Text>
            )}
            {mode === "return" && (
              <Textarea
                label="Required corrections"
                required
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
              />
            )}
            {mode !== "details" && (
              <Button
                disabled={mode === "return" && !note.trim()}
                onClick={() => {
                  const result =
                    mode === "release" ? release(selected.id) : returnDoc(selected.id, note.trim());
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success(
                      mode === "release"
                        ? "Document approved and released"
                        : "Document returned for correction",
                    );
                    setSelected(null);
                  }
                }}
              >
                {mode === "release" ? "Approve & release" : "Return for correction"}
              </Button>
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}

export function ExternalAccess() {
  const { grants, docs, addGrant, revokeGrant } = useLumen();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [readerClass, setReaderClass] = useState<string | null>("External Auditors");
  const [revoke, setRevoke] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        crumb="Governance / External access"
        title="External access"
        description="Give external reviewers time-limited access to selected approved documents."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setOpen(true)}>
            Add access grant
          </Button>
        }
      />
      <Panel>
        <DataTable
          headers={["External user", "Reader class", "Documents", "Validity", "Status", ""]}
        >
          {grants.map((g) => (
            <Table.Tr key={g.id}>
              <Table.Td fw={500}>
                {g.name}
                <Text size="xs" c="dimmed">
                  {g.email}
                </Text>
              </Table.Td>
              <Table.Td>{g.readerClass}</Table.Td>
              <Table.Td>
                {g.docIds.map((id) => docs.find((d) => d.id === id)?.title ?? id).join(", ")}
                <Text size="xs" c="dimmed">
                  {g.purpose}
                </Text>
              </Table.Td>
              <Table.Td>
                {g.start}
                <br />
                to {g.expiry}
              </Table.Td>
              <Table.Td>
                <StatusBadge status={grantStatus(g)} />
              </Table.Td>
              <Table.Td>
                <Button
                  size="xs"
                  color="red"
                  variant="subtle"
                  disabled={g.revoked}
                  onClick={() => setRevoke(g.id)}
                >
                  Revoke
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </DataTable>
      </Panel>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="New external access grant"
        centered
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const v = (k: string) => String(f.get(k) ?? "").trim();
            const days = daysBetween(v("start"), v("expiry"));
            if (!Number.isFinite(days) || days < 0 || days > 90) {
              toast.error("Expiry must be on or after the start and within 90 days.");
              return;
            }
            if (!ids.length || !readerClass || !v("name") || !v("purpose")) {
              toast.error("Select permitted documents and complete all fields.");
              return;
            }
            addGrant({
              name: v("name"),
              email: v("email"),
              readerClass,
              docIds: ids,
              start: v("start"),
              expiry: v("expiry"),
              purpose: v("purpose"),
            });
            setOpen(false);
            setIds([]);
            toast.success("Access grant created");
          }}
        >
          <Stack>
            <TextInput name="name" label="External user name" required />
            <TextInput name="email" type="email" label="Email" required />
            <Select
              label="Reader class"
              data={READER_CLASSES}
              value={readerClass}
              onChange={setReaderClass}
              required
            />
            <MultiSelect
              label="Permitted documents"
              searchable
              data={docs
                .filter((d) => d.status === "Approved & Current")
                .map((d) => ({ value: d.id, label: `${d.title} · v${d.version}` }))}
              value={ids}
              onChange={setIds}
              required
            />
            <SimpleGrid cols={2}>
              <TextInput name="start" type="date" label="Start date" required />
              <TextInput name="expiry" type="date" label="Expiry date" required />
            </SimpleGrid>
            <Text size="xs" c="dimmed">
              Maximum grant validity is 90 days.
            </Text>
            <Textarea name="purpose" label="Purpose" required />
            <Button type="submit">Create grant</Button>
          </Stack>
        </form>
      </Modal>
      <Modal opened={!!revoke} onClose={() => setRevoke(null)} title="Revoke access?" centered>
        <Stack>
          <Text size="sm">This reviewer will lose access to the documents in this grant.</Text>
          <Button
            color="red"
            onClick={() => {
              if (revoke) revokeGrant(revoke);
              setRevoke(null);
              toast.success("Access revoked");
            }}
          >
            Revoke access
          </Button>
        </Stack>
      </Modal>
    </>
  );
}

export function TeamCompletion() {
  const { assignments, docs } = useLumen();
  const [selected, setSelected] = useState<string | null>(null);
  const team = TEAM.map((person) => ({
    ...person,
    docs:
      person.name === ROLE_USERS.Employee.name
        ? assignments.map(
            (a) =>
              [docs.find((d) => d.id === a.docId)?.title ?? a.docId, a.acknowledged] as [
                string,
                boolean,
              ],
          )
        : person.docs,
  }));
  const person = team.find((p) => p.name === selected);
  return (
    <>
      <PageHeader
        crumb="Governance / Team"
        title="Team completion"
        description="Keep your team aligned with current policies and required reading."
      />
      <Panel>
        <DataTable headers={["Employee", "Assigned", "Completed", "Pending", "Completion", ""]}>
          {team.map((p) => {
            const completed = p.docs.filter(([, done]) => done).length;
            const percent = p.docs.length ? Math.round((completed / p.docs.length) * 100) : 0;
            return (
              <Table.Tr key={p.name}>
                <Table.Td fw={500}>
                  {p.name}
                  <Text size="xs" c="dimmed">
                    {p.dept}
                  </Text>
                </Table.Td>
                <Table.Td>{p.docs.length}</Table.Td>
                <Table.Td>{completed}</Table.Td>
                <Table.Td>{p.docs.length - completed}</Table.Td>
                <Table.Td>
                  <Text size="xs" mb={5}>
                    {percent}%
                  </Text>
                  <Progress value={percent} />
                </Table.Td>
                <Table.Td>
                  <Button size="xs" variant="light" onClick={() => setSelected(p.name)}>
                    View details
                  </Button>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </DataTable>
      </Panel>
      <Modal
        opened={!!person}
        onClose={() => setSelected(null)}
        title={`${person?.name ?? "Employee"} — reading details`}
        centered
      >
        <Stack>
          {person?.docs.map(([title, done]) => (
            <Group key={title} justify="space-between" wrap="nowrap">
              <Text size="sm">{title}</Text>
              <StatusBadge status={done ? "Completed" : "Pending"} />
            </Group>
          ))}
        </Stack>
      </Modal>
    </>
  );
}

export function AuditLogs() {
  const audit = useLumen((s) => s.audit);
  const [user, setUser] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const rows = audit.filter(
    (a) =>
      (!user || a.user === user) &&
      (!doc || a.doc === doc) &&
      (!action || a.action === action) &&
      (!from || a.ts.slice(0, 10) >= from) &&
      (!to || a.ts.slice(0, 10) <= to),
  );
  const exportCSV = () => {
    const cell = (v: string) => `"${(/^[=+@\-\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""')}"`;
    const csv = [
      ["User", "Action", "Document", "Version", "Timestamp", "Status"],
      ...rows.map((r) => [r.user, r.action, r.doc, r.version, r.ts, r.status]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "gaxis-lumen-audit.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`${rows.length} audit events exported`);
  };
  return (
    <>
      <PageHeader
        crumb="Governance / Audit"
        title="Audit logs"
        description="A chronological record of document access, publication and acknowledgements."
        actions={
          <Button variant="light" leftSection={<IconDownload size={16} />} onClick={exportCSV}>
            Export CSV
          </Button>
        }
      />
      <Panel>
        <SimpleGrid cols={{ base: 1, sm: 2, xl: 5 }} p="md">
          <Select
            aria-label="Filter user"
            placeholder="All users"
            clearable
            searchable
            data={[...new Set(audit.map((a) => a.user))]}
            value={user}
            onChange={setUser}
          />
          <Select
            aria-label="Filter document"
            placeholder="All documents"
            clearable
            searchable
            data={[...new Set(audit.map((a) => a.doc))]}
            value={doc}
            onChange={setDoc}
          />
          <Select
            aria-label="Filter action"
            placeholder="All actions"
            clearable
            data={[...new Set(audit.map((a) => a.action))]}
            value={action}
            onChange={setAction}
          />
          <TextInput
            aria-label="From date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.currentTarget.value)}
          />
          <TextInput
            aria-label="To date"
            type="date"
            min={from}
            value={to}
            onChange={(e) => setTo(e.currentTarget.value)}
          />
        </SimpleGrid>
        {!rows.length ? (
          <EmptyState title="No matching events" />
        ) : (
          <DataTable headers={["User", "Action", "Document", "Version", "Timestamp", "Status"]}>
            {rows.map((a) => (
              <Table.Tr key={a.id}>
                <Table.Td>{a.user}</Table.Td>
                <Table.Td>{a.action}</Table.Td>
                <Table.Td>{a.doc}</Table.Td>
                <Table.Td>{a.version}</Table.Td>
                <Table.Td>{fmtDate(a.ts)}</Table.Td>
                <Table.Td>
                  <StatusBadge status={a.status} />
                </Table.Td>
              </Table.Tr>
            ))}
          </DataTable>
        )}
        <Text size="xs" c="dimmed" p="md">
          {rows.length} events · Append-only demo history; reset demo data restores the initial
          records.
        </Text>
      </Panel>
    </>
  );
}

export function Administration() {
  const { directory, addDirectoryEntry } = useLumen();
  const [tab, setTab] = useState<string | null>("Users");
  const [open, setOpen] = useState(false);
  const sections = Object.keys(directory);
  return (
    <>
      <PageHeader
        crumb="Governance / Administration"
        title="Administration"
        description="Manage prototype reference data. Identity and permissions are simulated."
      />
      <Panel>
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List>
            {sections.map((s) => (
              <Tabs.Tab key={s} value={s}>
                {s}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {sections.map((section) => (
            <Tabs.Panel key={section} value={section}>
              <Group justify="space-between" p="lg">
                <Text fw={600}>{section}</Text>
                <Button
                  size="xs"
                  variant="light"
                  disabled={section === "Classification Settings"}
                  onClick={() => setOpen(true)}
                >
                  Add {section === "Users" ? "user" : "entry"}
                </Button>
              </Group>
              <DataTable headers={["Name", "Details", "Status"]}>
                {directory[section]?.map((r) => (
                  <Table.Tr key={r.name}>
                    <Table.Td fw={500}>{r.name}</Table.Td>
                    <Table.Td>{r.detail}</Table.Td>
                    <Table.Td>
                      <Badge color={r.name === "D4" ? "gray" : "green"} variant="light">
                        {r.name === "D4" ? "Unavailable in Release 1" : "Demo configuration"}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </DataTable>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Panel>
      <Modal opened={open} onClose={() => setOpen(false)} title={`Add to ${tab}`} centered>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const name = String(f.get("name") ?? "").trim();
            const detail = String(f.get("detail") ?? "").trim();
            if (!tab || !name || !detail) {
              toast.error("Complete all fields");
              return;
            }
            if (directory[tab]?.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
              toast.error("An entry with this name already exists");
              return;
            }
            addDirectoryEntry(tab, { name, detail });
            setOpen(false);
            toast.success("Demo configuration saved");
          }}
        >
          <Stack>
            <TextInput label="Name" name="name" required />
            <TextInput
              label={tab === "Users" ? "Email" : "Description"}
              name="detail"
              type={tab === "Users" ? "email" : "text"}
              required
            />
            <Text size="xs" c="dimmed">
              Reference data only. This does not create a login or change access rules.
            </Text>
            <Button type="submit">Save entry</Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}

function MediaPlayer({ media, onClose }: { media: Media; onClose: () => void }) {
  const { mediaProgress, setMedia, log } = useLumen();
  const saved = mediaProgress[media.id] ?? { watched: 0, acknowledged: false };
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<string | null>("1");
  const [captions, setCaptions] = useState(true);
  const [transcript, setTranscript] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const current = useLumen.getState().mediaProgress[media.id]?.watched ?? 0;
      const next = Math.min(100, current + (100 * Number(speed)) / media.duration);
      setMedia(media.id, next);
      if (next >= 100) setPlaying(false);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, speed, media, setMedia]);
  const line =
    media.transcript[
      Math.min(
        media.transcript.length - 1,
        Math.floor((saved.watched / 100) * media.transcript.length),
      )
    ];
  return (
    <Modal opened onClose={onClose} title={media.title} size="lg" centered>
      <Stack>
        <div className="flex min-h-60 flex-col items-center justify-center gap-5 rounded-xl bg-emerald-950 p-8 text-center text-white">
          <IconShieldCheck size={58} stroke={1} />
          <Text fw={600}>
            {media.type === "Audio" ? "Audio training simulation" : "Training preview simulation"}
          </Text>
          {captions && <Text size="sm">{line}</Text>}
          <Text size="xs" opacity={0.6}>
            Sample content · no real media file is loaded
          </Text>
        </div>
        <Progress value={saved.watched} />
        <Group justify="space-between">
          <Button onClick={() => setPlaying(!playing)} disabled={saved.watched >= 100}>
            {playing ? "Pause" : "Play"}
          </Button>
          <Text size="sm">
            {Math.floor((saved.watched * media.duration) / 100 / 60)} /{" "}
            {Math.floor(media.duration / 60)} min · {Math.floor(saved.watched)}%
          </Text>
          <Select
            aria-label="Playback speed"
            w={100}
            data={[
              { value: "1", label: "1×" },
              { value: "1.5", label: "1.5×" },
              { value: "2", label: "2×" },
            ]}
            value={speed}
            onChange={setSpeed}
          />
        </Group>
        <Group>
          <Checkbox
            checked={captions}
            onChange={(e) => setCaptions(e.currentTarget.checked)}
            label="Captions"
          />
          <Button variant="subtle" onClick={() => setTranscript(!transcript)}>
            {transcript ? "Hide transcript" : "Show transcript"}
          </Button>
        </Group>
        {transcript && (
          <Paper withBorder p="md">
            <Stack gap="xs">
              {media.transcript.map((t) => (
                <Text size="sm" key={t}>
                  {t}
                </Text>
              ))}
            </Stack>
          </Paper>
        )}
        <Text size="sm" c="dimmed">
          {media.requires90
            ? "Safety and induction: accumulate at least 90% playback to acknowledge."
            : "Complete playback to acknowledge this training."}
        </Text>
        <Button
          disabled={saved.acknowledged || saved.watched < (media.requires90 ? 90 : 100)}
          onClick={() => {
            setMedia(media.id, saved.watched, true);
            log("Media Acknowledged", media.title, "2026");
            toast.success("Training acknowledgement recorded");
          }}
        >
          {saved.acknowledged ? "Acknowledged" : "Confirm acknowledgement"}
        </Button>
      </Stack>
    </Modal>
  );
}

export function MediaLibrary() {
  const [selected, setSelected] = useState<Media | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string | null>(null);
  const rows = MEDIA.filter(
    (m) => m.title.toLowerCase().includes(q.toLowerCase()) && (!type || m.type === type),
  );
  return (
    <>
      <PageHeader
        crumb="Workspace / Media"
        title="Media library"
        description="Practical training, safety inductions and knowledge for your working day."
      />
      <Group mb="lg">
        <TextInput
          aria-label="Search media"
          placeholder="Search training materials…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          className="flex-1"
        />
        <Select
          aria-label="Media type"
          placeholder="All media"
          clearable
          data={["Video", "Audio"]}
          value={type}
          onChange={setType}
        />
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }}>
        {rows.map((m, i) => (
          <Paper key={m.id} withBorder radius="lg" className="overflow-hidden">
            <div
              className={`flex h-40 items-center justify-center ${i % 2 ? "bg-emerald-900" : "bg-emerald-800"} text-white`}
            >
              {m.type === "Audio" ? (
                <IconHeadphones size={54} stroke={1} />
              ) : (
                <IconShieldCheck size={64} stroke={1} />
              )}
            </div>
            <Stack p="lg" gap="sm">
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {m.type} · {Math.floor(m.duration / 60)} min
                </Text>
                <Badge variant="light">{m.classification}</Badge>
              </Group>
              <Text fw={600}>{m.title}</Text>
              <Text size="sm" c="dimmed">
                {m.family}
              </Text>
              <StatusBadge status={m.status} />
              <Button
                variant="light"
                mt="sm"
                leftSection={<IconPlayerPlay size={16} />}
                onClick={() => setSelected(m)}
              >
                Play training
              </Button>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
      {!rows.length && <EmptyState title="No matching training" />}
      {selected && (
        <MediaPlayer key={selected.id} media={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
