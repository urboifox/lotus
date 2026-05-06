import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  Link,
  Loader2,
  MailPlus,
  Share2,
  Shield,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { SubscriptionPlansModal } from "@/components/payment/SubscriptionPlansModal";
import {
  getShareLinkStatus,
  getShareUsers,
  useCreateShareLink,
  useRevokeShareLink,
  useRevokeShareUser,
  useShareWithUsers,
  type ShareAccessUser,
  type ShareLinkStatus,
  type ShareUserResult,
} from "@/services/docs";
import { useCurrentPlan } from "@/services/payment";
import type { CurrentPlan } from "@/types/payment";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string;
  documentTitle?: string;
}

const ownerUpgradeMessage =
  "File sharing is available on Lotus Pro. Upgrade to Pro to share your documents.";

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
type ShareRole = "viewer" | "editor";

const isProPlan = (plan?: CurrentPlan): boolean => {
  if (!plan) return false;

  const rawType = (
    plan.plan_type ??
    plan.type ??
    plan.plan_description ??
    ""
  ).toLowerCase();
  const status = (plan.subscription_status ?? plan.status ?? "active").toLowerCase();
  const endRaw = plan.current_period_end ?? plan.end_date ?? plan.next_renewal_date;
  const endMs = endRaw ? Date.parse(endRaw) : Number.NaN;
  const order = plan.order ?? null;

  return (
    rawType !== "free" &&
    !rawType.includes("free") &&
    order !== 1 &&
    (status === "active" || status === "trialing") &&
    Number.isFinite(endMs) &&
    endMs > Date.now()
  );
};

const RoleSelector = ({
  value,
  onChange,
}: {
  value: ShareRole;
  onChange: (value: ShareRole) => void;
}) => (
  <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-[#D8A8659C] bg-white p-1">
    <button
      type="button"
      onClick={() => onChange("viewer")}
      className={`rounded px-3 py-2 text-left text-xs font-semibold ${
        value === "viewer"
          ? "bg-[#FBF2E6] text-[#8a7048]"
          : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      Viewer
      <span className="block text-[11px] font-normal">Can read only</span>
    </button>
    <button
      type="button"
      onClick={() => onChange("editor")}
      className={`rounded px-3 py-2 text-left text-xs font-semibold ${
        value === "editor"
          ? "bg-[#FBF2E6] text-[#8a7048]"
          : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      Editor
      <span className="block text-[11px] font-normal">Can edit and save</span>
    </button>
  </div>
);

const parseEmails = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[,\n;]/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

const statusLabel: Record<string, string> = {
  shared: "Shared",
  already_shared: "Already has access",
  not_found: "No Lotus account found",
  not_pro: "User must upgrade to Pro",
  self: "Owner",
  invalid_email: "Invalid email",
  active: "Has access",
};

const statusClasses: Record<string, string> = {
  shared: "border-emerald-200 bg-emerald-50 text-emerald-800",
  already_shared: "border-blue-200 bg-blue-50 text-blue-800",
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  not_found: "border-amber-200 bg-amber-50 text-amber-900",
  not_pro: "border-amber-200 bg-amber-50 text-amber-900",
  self: "border-gray-200 bg-gray-50 text-gray-700",
  invalid_email: "border-red-200 bg-red-50 text-red-800",
};

export default function ShareModal({
  open,
  onOpenChange,
  documentId,
  documentTitle = "Untitled Document",
}: ShareModalProps) {
  const [status, setStatus] = useState<ShareLinkStatus | null>(null);
  const [people, setPeople] = useState<ShareAccessUser[]>([]);
  const [results, setResults] = useState<ShareUserResult[]>([]);
  const [emails, setEmails] = useState("");
  const [linkRole, setLinkRole] = useState<ShareRole>("viewer");
  const [emailRole, setEmailRole] = useState<ShareRole>("viewer");
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const queryClient = useQueryClient();
  const { data: currentPlanRaw, isLoading: planLoading } = useCurrentPlan(open);
  const currentPlan = currentPlanRaw as CurrentPlan | undefined;
  const isPro = isProPlan(currentPlan);

  const createShareMutation = useCreateShareLink();
  const revokeShareMutation = useRevokeShareLink();
  const shareWithUsersMutation = useShareWithUsers();
  const revokeShareUserMutation = useRevokeShareUser();

  const shareUrl = useMemo(() => {
    const token = status?.share_token;
    if (!token) return "";
    return `${window.location.origin}/share/${token}`;
  }, [status?.share_token]);

  const documentAccessUrl = useMemo(() => {
    if (!documentId) return "";
    return `${window.location.origin}/shared/document/${documentId}`;
  }, [documentId]);

  const isShared = Boolean(status?.is_shared && status.share_token);

  useEffect(() => {
    if (!open || !documentId) {
      setStatus(null);
      setPeople([]);
      setResults([]);
      setEmails("");
      setLinkRole("viewer");
      setEmailRole("viewer");
      setError(null);
      setNotice(null);
      setConfirmingRevoke(false);
      return;
    }

    let cancelled = false;
    setLoadingStatus(true);
    Promise.allSettled([getShareLinkStatus(documentId), getShareUsers(documentId)])
      .then(([linkResult, peopleResult]) => {
        if (cancelled) return;
        if (linkResult.status === "fulfilled") {
          setStatus(linkResult.value);
        } else {
          setError(
            linkResult.reason instanceof Error
              ? linkResult.reason.message
              : "Could not load link sharing status.",
          );
        }
        if (peopleResult.status === "fulfilled") {
          setPeople(peopleResult.value);
        } else {
          setPeople([]);
          setError(
            peopleResult.reason instanceof Error
              ? peopleResult.reason.message
              : "Could not load people with access.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, open]);


  const refreshPeople = async () => {
    if (!documentId) return;
    setPeople(await getShareUsers(documentId));
  };

  const showUpgradePrompt = () => {
    setError(ownerUpgradeMessage);
    setShowPlansModal(true);
  };

  const ensureCanShare = () => {
    if (!documentId) {
      setError("Save this file before sharing it.");
      return false;
    }
    if (planLoading && !currentPlan) {
      setError("Checking your subscription...");
      return false;
    }
    if (!isPro) {
      showUpgradePrompt();
      return false;
    }
    return true;
  };

  const handleGenerate = async () => {
    if (!ensureCanShare() || !documentId) return;

    setError(null);
    setNotice(null);
    const nextStatus = await createShareMutation.mutateAsync({
      documentId,
      canEdit: linkRole === "editor",
    });
    setStatus(nextStatus);
    setNotice("Share link created.");
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const handleCopy = async (value: string, message: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setNotice(message);
  };

  const handleRevokeLink = async () => {
    if (!documentId) return;
    setError(null);
    setNotice(null);
    const nextStatus = await revokeShareMutation.mutateAsync(documentId);
    setStatus(nextStatus);
    setConfirmingRevoke(false);
    setNotice("Sharing disabled.");
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const handleShareWithPeople = async () => {
    if (!ensureCanShare() || !documentId) return;

    const parsed = parseEmails(emails);
    const invalid = parsed.filter((email) => !emailPattern.test(email));
    if (!parsed.length) {
      setError("Enter at least one email address.");
      return;
    }
    if (invalid.length) {
      setResults(
        invalid.map((email) => ({
          email,
          status: "invalid_email",
          message: "Invalid email address.",
          can_edit: emailRole === "editor",
        })),
      );
      setError("Fix invalid email addresses before sharing.");
      return;
    }

    setError(null);
    setNotice(null);
    const response = await shareWithUsersMutation.mutateAsync({
      documentId,
      emails: parsed,
      canEdit: emailRole === "editor",
    });
    setResults(response.results);
    setPeople(response.shares);
    setEmails("");
    setNotice("Sharing updated.");
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const handleRevokeUser = async (sharedWithUserId: string) => {
    if (!documentId) return;
    setError(null);
    setNotice(null);
    await revokeShareUserMutation.mutateAsync({ documentId, sharedWithUserId });
    await refreshPeople();
    setNotice("Access removed.");
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogClose onClick={() => onOpenChange(false)} />
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <Share2 className="h-5 w-5 text-[#A97C3C]" />
                Share file
              </span>
            </DialogTitle>
            <DialogDescription>
              {documentTitle || "Untitled Document"}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto px-6 pb-2 space-y-5 font-poppins">
            <section className="rounded-md border border-[#D8A8659C] bg-[#FBF2E6] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">General access</div>
                  <p className="mt-1 text-xs text-[#806946]">
                    Anyone with the link must be logged in and subscribed to Lotus Pro to access this file.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#D8A8659C] bg-white px-3 py-1 text-sm text-gray-700">
                  {loadingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isShared ? (
                    <Check className="h-4 w-4 text-emerald-700" />
                  ) : (
                    <Shield className="h-4 w-4 text-gray-500" />
                  )}
                  {isShared ? "Anyone with link" : "Restricted"}
                </span>
              </div>

              {isShared && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                  <Link className="h-4 w-4 shrink-0 text-[#A97C3C]" />
                  <input
                    readOnly
                    value={shareUrl}
                    className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none"
                  />
                </div>
              )}

              {status?.created_at && (
                <p className="mt-2 text-xs text-gray-500">
                  Link created {new Date(status.created_at).toLocaleString()}
                  {typeof status.can_edit === "boolean"
                    ? ` Â· ${status.can_edit ? "Editor link" : "Viewer link"}`
                    : ""}
                </p>
              )}

              {!isShared && <RoleSelector value={linkRole} onChange={setLinkRole} />}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {!isShared ? (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={createShareMutation.isPending || loadingStatus || planLoading}
                    className="inline-flex items-center gap-2 rounded-md bg-[#A97C3C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {(createShareMutation.isPending || planLoading) && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Generate link
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCopy(shareUrl, "Share link copied.")}
                      className="inline-flex items-center gap-2 rounded-md border border-[#D8A8659C] bg-white px-4 py-2 text-sm font-semibold text-[#8a7048]"
                    >
                      <Clipboard className="h-4 w-4" />
                      Copy link
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingRevoke(true)}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Revoke link
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="rounded-md border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Share with people</div>
                  <p className="mt-1 text-xs text-gray-500">
                    Invited users must have a Lotus Pro account to access and edit this file.
                  </p>
                </div>
                {documentAccessUrl && (
                  <button
                    type="button"
                    onClick={() => handleCopy(documentAccessUrl, "Document link copied.")}
                    className="inline-flex items-center gap-2 rounded-md border border-[#D8A8659C] bg-[#FBF2E6] px-3 py-2 text-xs font-semibold text-[#8a7048]"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    Copy file link
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <textarea
                  value={emails}
                  onChange={(event) => setEmails(event.target.value)}
                  placeholder="name@example.com, teammate@example.com"
                  className="min-h-20 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#A97C3C]"
                />
                <button
                  type="button"
                  onClick={handleShareWithPeople}
                  disabled={shareWithUsersMutation.isPending || planLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#A97C3C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:self-start"
                >
                  {shareWithUsersMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MailPlus className="h-4 w-4" />
                  )}
                  Share
                </button>
              </div>
              <RoleSelector value={emailRole} onChange={setEmailRole} />

              {results.length > 0 && (
                <div className="mt-4 space-y-2">
                  {results.map((result) => (
                    <div
                      key={`${result.email}-${result.status}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {result.shared_with_user_name || result.email}
                        </div>
                        <div className="truncate text-xs text-gray-500">
                          {result.message}
                          {(result.status === "shared" || result.status === "already_shared") && (
                            result.email_sent ? " Email sent." : " Email not sent by SMTP."
                          )}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                          statusClasses[result.status] || statusClasses.active
                        }`}
                      >
                        {statusLabel[result.status] || result.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold text-gray-900">People with access</div>
                {people.length === 0 ? (
                  <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-500">
                    No people have been invited yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {people.map((person) => (
                      <div
                        key={person.shared_with_user_id}
                        className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">
                            {person.shared_with_user_name || person.shared_with_email}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            {person.shared_with_email || "Lotus user"} · {person.can_edit ? "Can edit" : "Can view"}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                            {person.can_edit ? "Editor" : "Viewer"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRevokeUser(person.shared_with_user_id)}
                            disabled={revokeShareUserMutation.isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                            title="Remove access"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {notice && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {notice}
              </div>
            )}
            {error && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {error}
              </div>
            )}

            {confirmingRevoke && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4">
                <div className="text-sm font-semibold text-red-900">
                  Revoke this share link?
                </div>
                <p className="mt-1 text-sm text-red-800">
                  The current link will stop working immediately.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-900"
                    onClick={() => setConfirmingRevoke(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={revokeShareMutation.isPending}
                    onClick={handleRevokeLink}
                  >
                    {revokeShareMutation.isPending ? "Revoking..." : "Revoke"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubscriptionPlansModal
        open={showPlansModal}
        onOpenChange={setShowPlansModal}
        reason="save-limit"
      />
    </>
  );
}


