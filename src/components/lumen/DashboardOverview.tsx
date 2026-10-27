import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Alert, Button, Group, Loader, Text } from "@mantine/core";
import { FileText } from "lucide-react";
import { Panel, StatCard } from "./common";
import {
  listDocuments,
  listMyPreparedDocuments,
  getReleaseQueue,
  type ApiDocument,
} from "@/lib/lumen/documents-api";
import { listAccessGrants } from "@/lib/lumen/access-grants-api";
import { listUsers } from "@/lib/lumen/users-api";
import type { NavKey } from "@/lib/lumen/access";

type Metric = { label: string; value: number | "Unavailable" };
type Summary = { value: number; documents?: ApiDocument[] };
const isApproved = (document: ApiDocument) =>
  document.is_active &&
  !!document.current_approved_version &&
  ["APPROVED_CURRENT", "RELEASED"].includes(document.current_approved_version.status);

export function DashboardOverview({ modules }: { modules: readonly NavKey[] }) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const requestId = ++generation.current;
    setLoading(true);
    setErrors([]);
    const jobs: { label: string; load: () => Promise<Summary> }[] = [];
    if (modules.includes("library"))
      jobs.push({
        label: "Approved documents",
        load: async () => {
          const records = (await listDocuments()).filter(isApproved);
          return { value: records.length, documents: records };
        },
      });
    if (modules.includes("prepared"))
      jobs.push({
        label: "Prepared documents",
        load: async () => ({ value: (await listMyPreparedDocuments()).length }),
      });
    if (modules.includes("release"))
      jobs.push({
        label: "Pending review versions",
        load: async () => ({ value: (await getReleaseQueue()).length }),
      });
    if (modules.includes("grants"))
      jobs.push({
        label: "Active access grants",
        load: async () => ({
          value: (await listAccessGrants()).filter((grant) => grant.status === "ACTIVE").length,
        }),
      });
    if (modules.includes("system"))
      jobs.push({
        label: "Active users",
        load: async () => ({
          value: (await listUsers()).filter((user) => user.status.toUpperCase() === "ACTIVE")
            .length,
        }),
      });
    const results = await Promise.allSettled(jobs.map((job) => job.load()));
    if (generation.current !== requestId) return;
    const failures: string[] = [];
    let approved: ApiDocument[] = [];
    setMetrics(
      results.map((result, index) => {
        const label = jobs[index]!.label;
        if (result.status === "fulfilled") {
          if (result.value.documents) approved = result.value.documents;
          return { label, value: result.value.value };
        }
        failures.push(
          `${label}: ${result.reason instanceof Error ? result.reason.message : "Unable to load this summary."}`,
        );
        return { label, value: "Unavailable" };
      }),
    );
    setDocuments(
      approved
        .sort((a, b) =>
          (b.current_approved_version?.released_at ?? "").localeCompare(
            a.current_approved_version?.released_at ?? "",
          ),
        )
        .slice(0, 5),
    );
    setErrors(failures);
    setLoading(false);
  }, [modules]);
  useEffect(() => {
    const requests = generation;
    void refresh();
    return () => {
      ++requests.current;
    };
  }, [refresh]);
  if (
    !modules.some((module) =>
      ["library", "prepared", "release", "grants", "system"].includes(module),
    )
  )
    return null;
  return (
    <div className="mb-6 space-y-4">
      <Group justify="flex-end">
        <Button variant="default" disabled={loading} onClick={() => void refresh()}>
          Refresh overview
        </Button>
      </Group>
      {errors.map((error) => (
        <Alert key={error} color="red" role="alert">
          {error}
        </Alert>
      ))}
      {loading ? (
        <Group role="status">
          <Loader size="sm" />
          <Text>Loading overview...</Text>
        </Group>
      ) : (
        <>
          {metrics.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.map((metric) => (
                <StatCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  icon={FileText}
                />
              ))}
            </div>
          )}
          {modules.includes("library") &&
            !errors.some((error) => error.startsWith("Approved documents:")) && (
              <Panel title="Recently Published">
                {documents.length === 0 ? (
                  <Text p="lg" c="dimmed">
                    No approved documents are available yet.
                  </Text>
                ) : (
                  <ul className="divide-y">
                    {documents.map((document) => (
                      <li key={document._id}>
                        <Link
                          to="/d/$id"
                          params={{ id: document._id }}
                          className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/50"
                        >
                          <div>
                            <Text fw={500}>{document.title}</Text>
                            <Text size="sm" c="dimmed">
                              {document.reference} · v
                              {document.current_approved_version?.version_number}
                            </Text>
                          </div>
                          <Text size="sm">Approved &amp; Current</Text>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
        </>
      )}
    </div>
  );
}
