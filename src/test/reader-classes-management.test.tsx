import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReaderClassesManagement } from "@/components/lumen/ReaderClassesManagement";
import {
  createReaderClass,
  getReaderClass,
  listReaderClasses,
  updateReaderClass,
  updateReaderClassStatus,
  type ApiReaderClass,
} from "@/lib/lumen/reader-classes-api";

vi.setConfig({ testTimeout: 20000 });
vi.mock("@/lib/lumen/reader-classes-api", () => ({
  createReaderClass: vi.fn(),
  getReaderClass: vi.fn(),
  listReaderClasses: vi.fn(),
  updateReaderClass: vi.fn(),
  updateReaderClassStatus: vi.fn(),
}));
const reader: ApiReaderClass = {
  _id: "a".repeat(24),
  class_name: "Contractor",
  class_code: "CONTRACTOR_CONSULTANT",
  description: "External readers",
  access_basis: "NAMED_ALLOWLIST",
  requires_document_allowlist: true,
  requires_expiry: true,
  max_grant_days: 90,
  allowed_classifications: ["D2", "D3"],
  excluded_families: ["HR"],
  is_active: true,
  created_at: "2026-10-25",
  updated_at: "2026-10-25",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listReaderClasses).mockResolvedValue([reader]);
  vi.mocked(getReaderClass).mockResolvedValue(reader);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function renderPage() {
  render(
    <MantineProvider env="test">
      <ReaderClassesManagement />
    </MantineProvider>,
  );
}

describe("Reader Classes management", () => {
  it("displays the required columns and fetches full details", async () => {
    renderPage();
    await screen.findByText(reader.class_code);
    for (const name of [
      "Class Name",
      "Class Code",
      "Access Basis",
      "Document Allowlist Required",
      "Expiry Required",
      "Maximum Grant Days",
      "Status",
      "Actions",
    ]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = await screen.findByRole("dialog");
    expect(getReaderClass).toHaveBeenCalledWith(reader._id);
    expect(within(dialog).getByText("External readers")).toBeInTheDocument();
    expect(within(dialog).getByText("HR")).toBeInTheDocument();
  });

  it("creates an allowlisted reader class with a 90-day expiry and refreshes", async () => {
    vi.mocked(createReaderClass).mockResolvedValue(reader);
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create reader class" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create reader class" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Class name/), {
      target: { value: "Contractor" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Class code/), {
      target: { value: "CONTRACTOR_CONSULTANT" },
    });
    fireEvent.click(within(dialog).getByRole("combobox", { name: /Access basis/ }));
    fireEvent.click(await screen.findByRole("option", { name: "Named Allowlist" }));
    fireEvent.click(within(dialog).getByLabelText("Document allowlist required"));
    fireEvent.click(within(dialog).getByLabelText("Expiry required"));
    expect(within(dialog).getByLabelText(/Maximum grant days/)).toHaveValue("90");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create reader class" }));
    await waitFor(() =>
      expect(createReaderClass).toHaveBeenCalledWith({
        class_name: "Contractor",
        class_code: "CONTRACTOR_CONSULTANT",
        description: "",
        access_basis: "NAMED_ALLOWLIST",
        requires_document_allowlist: true,
        requires_expiry: true,
        max_grant_days: 90,
      }),
    );
    await waitFor(() => expect(listReaderClasses).toHaveBeenCalledTimes(2));
  });

  it("loads existing values and sends null when expiry is disabled", async () => {
    vi.mocked(updateReaderClass).mockResolvedValue({
      ...reader,
      requires_expiry: false,
      max_grant_days: null,
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Class code/)).toHaveAttribute("readonly");
    expect(within(dialog).getByLabelText("Document allowlist required")).toBeChecked();
    fireEvent.click(within(dialog).getByLabelText("Expiry required"));
    expect(within(dialog).getByLabelText(/Maximum grant days/)).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateReaderClass).toHaveBeenCalledWith(reader._id, {
        class_name: reader.class_name,
        description: reader.description,
        access_basis: reader.access_basis,
        requires_document_allowlist: true,
        requires_expiry: false,
        max_grant_days: null,
      }),
    );
    await waitFor(() => expect(listReaderClasses).toHaveBeenCalledTimes(2));
  });

  it("retains form values on validation errors", async () => {
    vi.mocked(updateReaderClass).mockRejectedValue(new Error("Unable to update reader class"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Class name/), {
      target: { value: "Updated Contractor" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Unable to update reader class")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Class name/)).toHaveValue("Updated Contractor");
  });

  it("toggles status and refreshes the persisted list", async () => {
    let active = true;
    vi.mocked(listReaderClasses).mockImplementation(async () => [{ ...reader, is_active: active }]);
    vi.mocked(updateReaderClassStatus).mockImplementation(async (_id, status) => {
      active = status;
      return { ...reader, is_active: status };
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Activate" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Deactivate" })).toBeEnabled());
    expect(updateReaderClassStatus).toHaveBeenNthCalledWith(1, reader._id, false);
    expect(updateReaderClassStatus).toHaveBeenNthCalledWith(2, reader._id, true);
  });

  it("handles list and status errors without losing the current status", async () => {
    vi.mocked(listReaderClasses).mockRejectedValueOnce(new Error("Backend unavailable"));
    vi.mocked(updateReaderClassStatus).mockRejectedValue(new Error("Status update failed"));
    renderPage();
    expect(await screen.findByText("Backend unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("Status update failed")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
