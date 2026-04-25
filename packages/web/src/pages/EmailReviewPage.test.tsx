// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmailReviewPage } from "./EmailReviewPage.js";

vi.mock("../hooks/useEmails.js", () => ({
  useEmailsForReview: vi.fn(),
  useReviewEmail: vi.fn(),
}));

import { useEmailsForReview, useReviewEmail } from "../hooks/useEmails.js";
const mockUseEmailsForReview = vi.mocked(useEmailsForReview);
const mockUseReviewEmail = vi.mocked(useReviewEmail);

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <EmailReviewPage />
    </QueryClientProvider>,
  );
}

const pendingMessage = {
  id: "msg-1",
  agentId: "agent-1",
  agentName: "support-bot",
  direction: "outbound" as const,
  sender: "agent@openclaw.local",
  recipients: ["user@example.com"],
  cc: [],
  subject: "Re: Help with order",
  bodyText: "Your order has shipped.",
  bodyHtml: null,
  reviewStatus: "pending" as const,
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  visibleToAgent: false,
  sentAt: null,
  createdAt: "2026-01-15T10:00:00Z",
};

const approvedMessage = {
  ...pendingMessage,
  id: "msg-2",
  direction: "inbound" as const,
  sender: "user@example.com",
  recipients: ["agent@openclaw.local"],
  subject: "Question about returns",
  bodyText: "How do I return an item?",
  reviewStatus: "approved" as const,
  reviewedBy: "reviewer-1",
  visibleToAgent: true,
};

describe("EmailReviewPage", () => {
  let mutateFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mutateFn = vi.fn();
    mockUseReviewEmail.mockReturnValue({
      mutate: mutateFn,
      isPending: false,
      variables: undefined,
    } as unknown as ReturnType<typeof useReviewEmail>);
  });

  it("renders loading state with skeleton", () => {
    mockUseEmailsForReview.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    expect(screen.getByText("Email Review")).toBeTruthy();
    expect(screen.getByText("Direction")).toBeTruthy();
  });

  it("renders error state", () => {
    mockUseEmailsForReview.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network failure"),
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    expect(screen.getByText(/Error loading emails/)).toBeTruthy();
  });

  it("renders empty state", () => {
    mockUseEmailsForReview.mockReturnValue({
      data: { messages: [], total: 0, limit: 100, offset: 0 },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    expect(screen.getByText("No emails found.")).toBeTruthy();
  });

  it("renders messages in a table", () => {
    mockUseEmailsForReview.mockReturnValue({
      data: {
        messages: [pendingMessage],
        total: 1,
        limit: 100,
        offset: 0,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    expect(screen.getByText("Re: Help with order")).toBeTruthy();
    expect(screen.getAllByText("support-bot").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("agent@openclaw.local")).toBeTruthy();
    expect(screen.getByText("1 of 1 emails")).toBeTruthy();
  });

  it("expands a row to show body and action buttons", () => {
    mockUseEmailsForReview.mockReturnValue({
      data: {
        messages: [pendingMessage],
        total: 1,
        limit: 100,
        offset: 0,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    fireEvent.click(screen.getByText("Re: Help with order"));

    expect(screen.getByText("Your order has shipped.")).toBeTruthy();
    expect(screen.getByText("Approve")).toBeTruthy();
    expect(screen.getByText("Reject")).toBeTruthy();
  });

  it("calls mutate with approved status when Approve is clicked", () => {
    mockUseEmailsForReview.mockReturnValue({
      data: {
        messages: [pendingMessage],
        total: 1,
        limit: 100,
        offset: 0,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    fireEvent.click(screen.getByText("Re: Help with order"));
    fireEvent.click(screen.getByText("Approve"));

    expect(mutateFn).toHaveBeenCalledWith({
      messageId: "msg-1",
      status: "approved",
    });
  });

  it("calls mutate with rejected status when Reject is clicked", () => {
    mockUseEmailsForReview.mockReturnValue({
      data: {
        messages: [pendingMessage],
        total: 1,
        limit: 100,
        offset: 0,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    fireEvent.click(screen.getByText("Re: Help with order"));
    fireEvent.click(screen.getByText("Reject"));

    expect(mutateFn).toHaveBeenCalledWith({
      messageId: "msg-1",
      status: "rejected",
    });
  });

  it("does not show approve/reject buttons for non-pending status filter", () => {
    mockUseEmailsForReview.mockReturnValue({
      data: {
        messages: [approvedMessage],
        total: 1,
        limit: 100,
        offset: 0,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    fireEvent.change(screen.getByDisplayValue("Pending"), {
      target: { value: "approved" },
    });

    mockUseEmailsForReview.mockReturnValue({
      data: {
        messages: [approvedMessage],
        total: 1,
        limit: 100,
        offset: 0,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    fireEvent.click(screen.getAllByText("Question about returns")[0]);

    expect(screen.queryByText("Approve")).toBeNull();
    expect(screen.queryByText("Reject")).toBeNull();
  });

  it("shows reviewing state on buttons during mutation", () => {
    mockUseReviewEmail.mockReturnValue({
      mutate: mutateFn,
      isPending: true,
      variables: { messageId: "msg-1", status: "approved" },
    } as unknown as ReturnType<typeof useReviewEmail>);

    mockUseEmailsForReview.mockReturnValue({
      data: {
        messages: [pendingMessage],
        total: 1,
        limit: 100,
        offset: 0,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    fireEvent.click(screen.getByText("Re: Help with order"));

    const buttons = screen.getAllByText("...");
    expect(buttons.length).toBe(2);
  });

  it("populates agent filter dropdown from messages", () => {
    mockUseEmailsForReview.mockReturnValue({
      data: {
        messages: [pendingMessage, { ...pendingMessage, id: "msg-3", agentId: "agent-2", agentName: "wiki-bot" }],
        total: 2,
        limit: 100,
        offset: 0,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    expect(screen.getAllByText("support-bot").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("wiki-bot").length).toBeGreaterThanOrEqual(1);
  });

  it("renders message with no body text", () => {
    mockUseEmailsForReview.mockReturnValue({
      data: {
        messages: [{ ...pendingMessage, bodyText: null }],
        total: 1,
        limit: 100,
        offset: 0,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEmailsForReview>);

    renderPage();

    fireEvent.click(screen.getByText("Re: Help with order"));

    expect(screen.getByText("(no text body)")).toBeTruthy();
  });
});
