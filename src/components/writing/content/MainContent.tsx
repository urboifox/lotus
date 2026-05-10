import CustomSection from "@/components/ui/CustomSection";
import React, { useRef, useState, useEffect, useCallback } from "react";
import Sidebar from "../menu/Sidebar";
import Assistant from "./AssistantBar";
import {
  acquireDocumentLock,
  GetDocumentById,
  GetSharedDocumentById,
  GetSharedDocumentByToken,
  heartbeatDocumentLock,
  releaseDocumentLock,
  type DocumentLockStatus,
} from "@/services/docs";
import { useLocation } from "react-router-dom";
import EditorActions from "./EditorActions";
import ShadingPatterns from "./ShadingPatterns";
import MagicBox from "./MagicBox";
import type { CartoucheShape } from "./CartouchePicker";
import { SubscriptionPlansModal } from "@/components/payment/SubscriptionPlansModal";

interface LocationState {
  document?: {
    id: string;
    title: string;
    html?: string;
    updated_at: string;
  };
}

interface MainContentProps {
  shareToken?: string;
  sharedDocumentId?: string;
}

interface HistorySelectionPoint {
  path: number[];
  offset: number;
}

interface HistorySelectionState {
  start: HistorySelectionPoint;
  end: HistorySelectionPoint;
}

interface HistoryEntry {
  html: string;
  selection: HistorySelectionState | null;
}

export default function MainContent({ shareToken, sharedDocumentId }: MainContentProps) {
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const editingDocumentFromState = locationState?.document;
  const isSharedLinkMode = Boolean(shareToken);
  const isSharedDocumentMode = Boolean(sharedDocumentId);

  // Fetch full document if we only have metadata (no HTML)
  const shouldFetchDocument =
    !isSharedLinkMode &&
    !isSharedDocumentMode &&
    editingDocumentFromState &&
    !editingDocumentFromState.html;
  const { data: fetchedDocument, isLoading: isFetchingDocument } =
    GetDocumentById(shouldFetchDocument ? editingDocumentFromState.id : "");
  const {
    data: sharedDocument,
    isLoading: isLoadingSharedDocument,
    error: sharedDocumentError,
  } = GetSharedDocumentByToken(shareToken || "");
  const {
    data: sharedDocumentById,
    isLoading: isLoadingSharedDocumentById,
    error: sharedDocumentByIdError,
  } = GetSharedDocumentById(sharedDocumentId || "");

  // Use fetched document if available, otherwise use the one from state
  const editingDocument = isSharedLinkMode
    ? sharedDocument
    : isSharedDocumentMode
      ? sharedDocumentById
    : shouldFetchDocument
      ? fetchedDocument
      : editingDocumentFromState;
  const isLoadingDocument = isSharedLinkMode
    ? isLoadingSharedDocument
    : isSharedDocumentMode
      ? isLoadingSharedDocumentById
    : isFetchingDocument;

  const editorRef = useRef<HTMLDivElement>(null);
  const dragSourceRef = useRef<string>("");
  const draggedElementRef = useRef<HTMLElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const pngCacheRef = useRef<Map<string, string>>(new Map());
  // Deferred / chunked PNG-cache scheduler.
  //
  // `cachePngForSvgIcon` allocates a canvas at COPY_SCALE×, serializes the
  // SVG, fires an async <img> decode, then synchronously encodes a PNG via
  // `canvas.toDataURL`. Calling that for *every* icon in handlers like
  // `handleIconSizeChange` (which iterates the whole document) was the cause
  // of the RAM spike + UI freeze on "select all + change size": many large
  // canvases live in memory at once and many toDataURL calls block the main
  // thread back-to-back.
  //
  // Instead, we queue icons to be re-rasterized and process the queue in
  // small chunks during browser idle time. The Map is keyed by data-id so
  // repeated requests for the same icon coalesce. Flushing also prunes
  // cache entries for icons that no longer exist in the editor (merge /
  // relayout assigns new ids, leaving the old entries dangling forever).
  const pngCacheQueueRef = useRef<Map<string, HTMLElement>>(new Map());
  const pngCacheScheduledRef = useRef<number | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const isApplyingHistoryRef = useRef(false);
  const typingHistoryActiveRef = useRef(false);
  const selectedIconsRef = useRef<Element[]>([]);
  const pointerDownPointRef = useRef<{ x: number; y: number } | null>(null);
  const isPointerDraggingRef = useRef(false);
  const suppressEditorClickRef = useRef(false);
  const typingHistoryTimerRef = useRef<number | null>(null);
  const [selectedIcons, setSelectedIcons] = useState<Element[]>([]);
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr");
  const [columnMode, setColumnMode] = useState(false);
  const [selectedIconCount, setSelectedIconCount] = useState(0);
  const [textSize, setTextSize] = useState(18);
  const [iconSize, setIconSize] = useState(39);
  const [selectedSingleIcon, setSelectedSingleIcon] = useState<Element | null>(
    null,
  );
  const [showShadingOptions, setShowShadingOptions] = useState(false);
  const [selectedIconHasShading, setSelectedIconHasShading] = useState(false);
  // Representative rotation (degrees, 0..359) for the current selection.
  // 0 if nothing selected or if selection mixes different rotations — the
  // toolbar uses this to highlight the Rotate button and seed the dial.
  const [selectedIconRotation, setSelectedIconRotation] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showMagicBox, setShowMagicBox] = useState(false);
  const [showSharedAccessPlansModal, setShowSharedAccessPlansModal] =
    useState(false);
  const [lockStatus, setLockStatus] = useState<DocumentLockStatus | null>(null);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [hasEditLock, setHasEditLock] = useState(false);
  const [isAcquiringLock, setIsAcquiringLock] = useState(false);
  const lockSessionIdRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `lotus-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const isEditMode = Boolean(
    isSharedLinkMode ||
      isSharedDocumentMode ||
      editingDocumentFromState ||
      savedDocId,
  );
  const editingDocId =
    savedDocId ||
    (isSharedLinkMode
      ? sharedDocument?.id
      : isSharedDocumentMode
        ? sharedDocumentById?.id || sharedDocumentId
        : editingDocumentFromState?.id) ||
    "";
  const documentAllowsEdit = !isEditMode || editingDocument?.can_edit !== false;
  const editorCanEdit = documentAllowsEdit && (!isEditMode || hasEditLock);
  const readOnlyReason =
    lockMessage ||
    (lockStatus?.active_editor_name
      ? `This file is currently being edited by ${lockStatus.active_editor_name}. Editing is locked until they leave.`
      : "Editing is temporarily locked for this file.");
  const sharedAccessError =
    (isSharedLinkMode && sharedDocumentError) ||
    (isSharedDocumentMode && sharedDocumentByIdError)
      ? (sharedDocumentError || sharedDocumentByIdError) instanceof Error
        ? (sharedDocumentError || sharedDocumentByIdError)?.message
        : "This shared file is not available."
      : null;

  const toggleFullScreen = () => {
    setIsFullScreen((prev) => !prev);
  };

  useEffect(() => {
    if (!isEditMode) {
      setHasEditLock(true);
      setIsAcquiringLock(false);
      setLockStatus(null);
      setLockMessage(null);
      return;
    }

    if (!editingDocId || isLoadingDocument) {
      setHasEditLock(false);
      setIsAcquiringLock(false);
      return;
    }

    if (editingDocument?.can_edit === false) {
      setHasEditLock(false);
      setIsAcquiringLock(false);
      setLockMessage(
        editingDocument?.owner_subscription_active === false
          ? "This shared document is no longer editable because the owner's Pro subscription is inactive."
          : "You can view this file, but you do not have edit access.",
      );
      return;
    }

    let cancelled = false;
    let acquiredByThisSession = false;
    let retryTimerId: number | undefined;
    let retryCount = 0;
    const lockParams = {
      documentId: editingDocId,
      shareToken,
      sessionId: lockSessionIdRef.current,
    };

    const scheduleAcquire = (delayMs: number) => {
      if (retryCount >= 10) {
        setIsAcquiringLock(false);
        setLockMessage("Could not acquire editing lock after multiple attempts. Please refresh the page.");
        return;
      }
      retryTimerId = window.setTimeout(() => {
        if (!cancelled) {
          retryCount += 1;
          attemptAcquire();
        }
      }, delayMs);
    };

    const attemptAcquire = () => {
      setIsAcquiringLock(true);
      acquireDocumentLock(lockParams)
        .then((status) => {
          if (cancelled) return;
          setLockStatus(status);
          acquiredByThisSession = Boolean(status.is_locked_by_me);
          setHasEditLock(acquiredByThisSession);
          setIsAcquiringLock(false);
          if (acquiredByThisSession) {
            setLockMessage("You are editing this file.");
          } else if (status.active_editor_name) {
            setLockMessage(`This file is currently being edited by ${status.active_editor_name}. You can view it for now.`);
          }
        })
        .catch((error) => {
          if (cancelled) return;
          setHasEditLock(false);
          setIsAcquiringLock(false);
          const msg = error instanceof Error ? error.message.toLowerCase() : "";
          const isConflict = msg.includes("locked") || msg.includes("editing") || msg.includes("edit access");
          if (isConflict) {
            setLockMessage(
              error instanceof Error
                ? error.message
                : "This file is currently locked by another editor.",
            );
          }
          if (isConflict) {
            const retryAfterSeconds =
              typeof (error as { retry_after_seconds?: unknown })?.retry_after_seconds === "number"
                ? (error as { retry_after_seconds: number }).retry_after_seconds
                : 5;
            scheduleAcquire(Math.max(1_000, retryAfterSeconds * 1_000));
          }
        });
    };

    setHasEditLock(false);
    if (editingDocument?.is_locked && !editingDocument?.is_locked_by_me) {
      const lockedBy = editingDocument.active_editor_name || "another user";
      setIsAcquiringLock(false);
      setLockMessage(`This file is currently being edited by ${lockedBy}. You can view it for now.`);
      const expiresMs = editingDocument.lock_expires_at
        ? Date.parse(editingDocument.lock_expires_at) - Date.now() + 500
        : 5_000;
      scheduleAcquire(Math.max(1_000, Math.min(expiresMs, 60_000)));
    } else {
      setLockMessage("Connecting to editing session...");
      attemptAcquire();
    }

    return () => {
      cancelled = true;
      setIsAcquiringLock(false);
      if (retryTimerId !== undefined) window.clearTimeout(retryTimerId);
      if (acquiredByThisSession) {
        void releaseDocumentLock(lockParams).catch(() => undefined);
      }
    };
  }, [
    editingDocId,
    editingDocument?.can_edit,
    editingDocument?.is_locked,
    editingDocument?.is_locked_by_me,
    editingDocument?.active_editor_name,
    editingDocument?.lock_expires_at,
    editingDocument?.owner_subscription_active,
    isEditMode,
    isLoadingDocument,
    shareToken,
  ]);

  useEffect(() => {
    if (!isEditMode || !editingDocId || !hasEditLock) return;

    const lockParams = {
      documentId: editingDocId,
      shareToken,
      sessionId: lockSessionIdRef.current,
    };

    let consecutiveFailures = 0;
    const timerId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void heartbeatDocumentLock(lockParams)
        .then((status) => {
          consecutiveFailures = 0;
          setLockStatus(status);
          const canKeepEditing = Boolean(status.is_locked_by_me) && status.can_edit !== false;
          setHasEditLock(canKeepEditing);
          if (status.owner_subscription_active === false || status.can_edit === false) {
            setLockMessage("This shared document is no longer editable because the owner's Pro subscription is inactive.");
            return;
          }
          if (canKeepEditing) {
            setLockMessage("You are editing this file.");
          }
        })
        .catch((error) => {
          const msg = error instanceof Error ? error.message.toLowerCase() : "";
          const isLockConflict = msg.includes("locked") || msg.includes("editing") || msg.includes("edit access");
          if (isLockConflict) {
            setHasEditLock(false);
            setLockMessage(
              error instanceof Error
                ? error.message
                : "Your editing lock was lost. Please try again.",
            );
          } else {
            consecutiveFailures++;
            setLockMessage("Connection lost. Reconnecting to editing session...");
            if (consecutiveFailures >= 3) {
              setHasEditLock(false);
              setLockMessage("Editing lock lost. Please try again.");
            }
          }
        });
    }, 15_000);

    return () => window.clearInterval(timerId);
  }, [editingDocId, hasEditLock, isEditMode, shareToken]);

  useEffect(() => {
    if (!isEditMode || !editingDocId || !hasEditLock) return;

    const sendHeartbeat = () => {
      if (document.visibilityState !== "visible") return;
      void heartbeatDocumentLock({
        documentId: editingDocId,
        shareToken,
        sessionId: lockSessionIdRef.current,
      })
        .then((status) => {
          setLockStatus(status);
          const canKeepEditing = Boolean(status.is_locked_by_me) && status.can_edit !== false;
          setHasEditLock(canKeepEditing);
          if (status.owner_subscription_active === false || status.can_edit === false) {
            setLockMessage("This shared document is no longer editable because the owner's Pro subscription is inactive.");
            return;
          }
          if (canKeepEditing) {
            setLockMessage("You are editing this file.");
          }
        })
        .catch((error) => {
          setHasEditLock(false);
          setLockMessage(
            error instanceof Error
              ? error.message
              : "Editing lock lost. Please try again.",
          );
        });
    };

    document.addEventListener("visibilitychange", sendHeartbeat);
    return () => document.removeEventListener("visibilitychange", sendHeartbeat);
  }, [editingDocId, hasEditLock, isEditMode, shareToken]);

  useEffect(() => {
    if (!isEditMode || !editingDocId || !hasEditLock) return;

    const lockParams = {
      documentId: editingDocId,
      shareToken,
      sessionId: lockSessionIdRef.current,
    };

    const releaseLockBestEffort = () => {
      try {
        const path = lockParams.shareToken
          ? `/share/${encodeURIComponent(lockParams.shareToken)}/lock/release`
          : `/documents-html/${lockParams.documentId}/lock/release`;
        const body = JSON.stringify({ session_id: lockParams.sessionId });
        const token = localStorage.getItem("token") || "";
        const apiKey = import.meta.env.VITE_API_KEY || "";
        const baseUrl = import.meta.env.VITE_API_URL || "";
        const url = `${baseUrl}${path}`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (apiKey) headers["x-api-key"] = apiKey;
        void fetch(url, { method: "POST", headers, body, keepalive: true });
      } catch {
        // best-effort
      }
    };

    const onBeforeUnload = () => releaseLockBestEffort();
    const onPageHide = () => releaseLockBestEffort();

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [editingDocId, hasEditLock, isEditMode, shareToken]);

  const handleDocumentSaved = useCallback((doc: { id: string; title: string }) => {
    setSavedDocId(doc.id);
  }, []);

  const handleRetryLock = useCallback(() => {
    if (!editingDocId) return;
    setIsAcquiringLock(true);
    setLockMessage("Connecting to editing session...");
    acquireDocumentLock({
      documentId: editingDocId,
      shareToken,
      sessionId: lockSessionIdRef.current,
    })
      .then((status) => {
        setLockStatus(status);
        const acquired = Boolean(status.is_locked_by_me);
        setHasEditLock(acquired);
        setIsAcquiringLock(false);
        if (acquired) {
          setLockMessage("You are editing this file.");
        } else if (status.active_editor_name) {
          setLockMessage(`This file is currently being edited by ${status.active_editor_name}. You can view it for now.`);
        }
      })
      .catch((error) => {
        setHasEditLock(false);
        setIsAcquiringLock(false);
        const msg = error instanceof Error ? error.message.toLowerCase() : "";
        const isLock = msg.includes("locked") || msg.includes("editing") || msg.includes("edit access");
        if (isLock) {
          setLockMessage(
            error instanceof Error
              ? error.message
              : "This file is currently locked by another editor.",
          );
        }
      });
  }, [editingDocId, shareToken]);

  const resetTypingHistorySession = () => {
    typingHistoryActiveRef.current = false;
    if (typingHistoryTimerRef.current) {
      clearTimeout(typingHistoryTimerRef.current);
      typingHistoryTimerRef.current = null;
    }
  };

  const scheduleTypingHistoryReset = () => {
    if (typingHistoryTimerRef.current) {
      clearTimeout(typingHistoryTimerRef.current);
    }
    typingHistoryTimerRef.current = window.setTimeout(() => {
      typingHistoryActiveRef.current = false;
      typingHistoryTimerRef.current = null;
    }, 400);
  };

  const getNodePath = (root: Node, node: Node): number[] | null => {
    const path: number[] = [];
    let current: Node | null = node;

    while (current && current !== root) {
      const parent: Node | null = current.parentNode;
      if (!parent) return null;
      path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
      current = parent;
    }

    return current === root ? path : null;
  };

  const resolveNodePath = (root: Node, path: number[]): Node | null => {
    let current: Node | null = root;

    for (const index of path) {
      if (!current || index < 0 || index >= current.childNodes.length) {
        return null;
      }
      current = current.childNodes[index];
    }

    return current;
  };

  const getNodeOffsetLimit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent?.length ?? 0;
    }

    return node.childNodes.length;
  };

  const captureSelectionState = (
    editor: HTMLElement,
  ): HistorySelectionState | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;

    const startPath = getNodePath(editor, range.startContainer);
    const endPath = getNodePath(editor, range.endContainer);
    if (!startPath || !endPath) return null;

    return {
      start: { path: startPath, offset: range.startOffset },
      end: { path: endPath, offset: range.endOffset },
    };
  };

  const restoreSelectionState = (
    editor: HTMLElement,
    selection: HistorySelectionState | null,
  ) => {
    const sel = window.getSelection();
    if (!sel) return;

    sel.removeAllRanges();

    if (!selection) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
      return;
    }

    const startNode = resolveNodePath(editor, selection.start.path);
    const endNode = resolveNodePath(editor, selection.end.path);

    if (!startNode || !endNode) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
      return;
    }

    const range = document.createRange();
    range.setStart(
      startNode,
      Math.min(selection.start.offset, getNodeOffsetLimit(startNode)),
    );
    range.setEnd(
      endNode,
      Math.min(selection.end.offset, getNodeOffsetLimit(endNode)),
    );
    sel.addRange(range);
    savedRangeRef.current = range.cloneRange();
  };

  const getSanitizedEditorHtml = (editor: HTMLElement) => {
    const clone = editor.cloneNode(true) as HTMLElement;

    clone
      .querySelectorAll('[data-selection-boundary="true"]')
      .forEach((node) => node.remove());

    clone
      .querySelectorAll('[data-editor-line-spacer="true"]')
      .forEach((node) => {
        const text = (node.textContent || "").replace(/\u200B/g, "");
        if (text.length > 0) {
          node.replaceWith(document.createTextNode(text));
        } else {
          node.remove();
        }
      });

    clone
      .querySelectorAll('br[data-editor-line-break="true"]')
      .forEach((node) => node.removeAttribute("data-editor-line-break"));

    clone
      .querySelectorAll(".cartouche-inner-resize-controls")
      .forEach((node) => node.remove());

    clone.querySelectorAll(".svg-icon").forEach((icon) => {
      const el = icon as HTMLElement;
      el.style.backgroundColor = "";
      el.style.outline = "";
      el.style.outlineOffset = "";
      el.style.opacity = "";
      delete el.dataset.selectMode;
      delete el.dataset.selectedInnerIdx;
    });

    return clone.innerHTML;
  };

  const captureHistoryEntry = (): HistoryEntry | null => {
    const editor = editorRef.current;
    if (!editor) return null;

    return {
      html: getSanitizedEditorHtml(editor),
      selection: captureSelectionState(editor),
    };
  };

  const commitHistory = (mode: "push" | "replace" = "push") => {
    if (isApplyingHistoryRef.current) return;

    const entry = captureHistoryEntry();
    if (!entry) return;

    const current = historyRef.current[historyIndexRef.current];
    if (current?.html === entry.html) {
      historyRef.current[historyIndexRef.current] = entry;
      return;
    }

    if (mode === "replace" && historyIndexRef.current >= 0) {
      historyRef.current[historyIndexRef.current] = entry;
      return;
    }

    const nextHistory = historyRef.current.slice(
      0,
      historyIndexRef.current + 1,
    );
    nextHistory.push(entry);
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
  };

  const initializeHistory = () => {
    const entry = captureHistoryEntry();
    if (!entry) return;

    historyRef.current = [entry];
    historyIndexRef.current = 0;
    resetTypingHistorySession();
  };

  const applyHistoryEntry = (entry: HistoryEntry) => {
    const editor = editorRef.current;
    if (!editor) return;

    isApplyingHistoryRef.current = true;
    resetTypingHistorySession();

    editor.innerHTML = entry.html;
    setSelectedIcons([]);
    setSelectedIconCount(0);
    setSelectedSingleIcon(null);
    setSelectedIconHasShading(false);

    editor.focus();
    restoreSelectionState(editor, entry.selection);

    requestAnimationFrame(() => {
      const icons = editor.querySelectorAll(".svg-icon");
      icons.forEach((icon) => {
        const el = icon as HTMLElement;
        if (el.dataset.id && !pngCacheRef.current.has(el.dataset.id)) {
          scheduleCachePng(el);
        }
      });
      isApplyingHistoryRef.current = false;
    });
  };

  const performUndo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const entry = historyRef.current[historyIndexRef.current];
    if (entry) {
      applyHistoryEntry(entry);
    }
  };

  const performRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const entry = historyRef.current[historyIndexRef.current];
    if (entry) {
      applyHistoryEntry(entry);
    }
  };

  const handleTextCommand = (command: string, value: string | null = null) => {
    if (!editorCanEdit) return;

    if (command === "undo") {
      performUndo();
      editorRef.current?.focus();
      return;
    }

    if (command === "redo") {
      performRedo();
      editorRef.current?.focus();
      return;
    }

    resetTypingHistorySession();
    restoreSavedRangeIfNeeded();
    editorRef.current?.focus();
    try {
      document.execCommand(command, false, value || "");
      window.setTimeout(() => {
        commitHistory("push");
      }, 0);
    } catch (error) {
      console.error("Error executing text command:", error);
    }
    editorRef.current?.focus();
  };

  const getSelectionRange = () => {
    const editor = editorRef.current;
    if (!editor) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    return range;
  };

  const unwrapTextSizeSpans = (root: ParentNode) => {
    const spans = Array.from(
      root.querySelectorAll("span[data-text-size]"),
    ) as HTMLElement[];
    spans.forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    });
  };

  const isEffectivelyEmpty = (el: HTMLElement) => {
    const text = (el.textContent || "").replace(/\u200B/g, "").trim();
    if (text.length > 0) return false;
    if (el.querySelector("img, svg, br, .svg-icon")) return false;
    return true;
  };

  const normalizeTextSizeSpans = (root: HTMLElement) => {
    const spans = Array.from(
      root.querySelectorAll("span[data-text-size]"),
    ) as HTMLElement[];

    spans.forEach((span) => {
      if (isEffectivelyEmpty(span)) {
        span.remove();
      }
    });

    spans.forEach((span) => {
      const childSpans = Array.from(
        span.querySelectorAll(":scope > span[data-text-size]"),
      ) as HTMLElement[];
      if (childSpans.length === 0) return;

      const hasDirectText = Array.from(span.childNodes).some(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          (node.textContent || "").replace(/\u200B/g, "").trim().length > 0,
      );

      const hasNonSpanElements = Array.from(span.childNodes).some(
        (node) =>
          node.nodeType === Node.ELEMENT_NODE &&
          !(node as Element).matches("span[data-text-size]"),
      );

      if (!hasDirectText && !hasNonSpanElements) {
        const parent = span.parentNode;
        if (!parent) return;
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
      }
    });

    const allSpans = Array.from(
      root.querySelectorAll("span[data-text-size]"),
    ) as HTMLElement[];
    allSpans.forEach((span) => {
      const next = span.nextSibling as HTMLElement | null;
      if (
        next &&
        next.nodeType === Node.ELEMENT_NODE &&
        next.matches("span[data-text-size]") &&
        next.dataset.textSize === span.dataset.textSize
      ) {
        while (next.firstChild) {
          span.appendChild(next.firstChild);
        }
        next.remove();
      }
    });
  };

  const splitParentTextSizeSpan = (node: HTMLElement) => {
    const parent = node.parentElement?.closest("span[data-text-size]");
    if (!parent || parent === node) return;

    const parentSize = (parent as HTMLElement).dataset.textSize || "";
    const parentFontSize = (parent as HTMLElement).style.fontSize || "";

    const before = document.createElement("span");
    before.dataset.textSize = parentSize;
    before.style.fontSize = parentFontSize;

    const after = document.createElement("span");
    after.dataset.textSize = parentSize;
    after.style.fontSize = parentFontSize;

    let current = parent.firstChild;
    while (current && current !== node) {
      const next = current.nextSibling;
      before.appendChild(current);
      current = next;
    }

    current = node.nextSibling;
    while (current) {
      const next = current.nextSibling;
      after.appendChild(current);
      current = next;
    }

    const container = parent.parentNode;
    if (!container) return;
    if (!isEffectivelyEmpty(before)) {
      container.insertBefore(before, parent);
    }
    container.insertBefore(node, parent);
    if (!isEffectivelyEmpty(after)) {
      container.insertBefore(after, parent);
    }
    parent.remove();
  };

  const applyTextSizeToSelection = (size: number) => {
    const editor = editorRef.current;
    if (!editor) return false;
    const range = getSelectionRange();
    if (!range || range.collapsed) return false;

    const sel = window.getSelection();
    if (!sel) return false;

    const wrapper = document.createElement("span");
    wrapper.dataset.textSize = String(size);
    wrapper.style.fontSize = `${size}px`;
    const contents = range.extractContents();
    unwrapTextSizeSpans(contents);
    wrapper.appendChild(contents);
    range.insertNode(wrapper);
    splitParentTextSizeSpan(wrapper);
    normalizeTextSizeSpans(editor);

    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    sel.removeAllRanges();
    sel.addRange(newRange);
    savedRangeRef.current = newRange.cloneRange();
    return true;
  };

  const applyTextSizeToCaret = (size: number) => {
    const editor = editorRef.current;
    if (!editor) return false;
    const range = getSelectionRange();
    if (!range || !range.collapsed) return false;

    const sel = window.getSelection();
    if (!sel) return false;

    const wrapper = document.createElement("span");
    wrapper.dataset.textSize = String(size);
    wrapper.dataset.typingSize = "true";
    wrapper.style.fontSize = `${size}px`;
    const zwsp = document.createTextNode("\u200B");
    wrapper.appendChild(zwsp);
    range.insertNode(wrapper);

    const newRange = document.createRange();
    newRange.setStart(zwsp, 1);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    savedRangeRef.current = newRange.cloneRange();
    return true;
  };

  const handleTextSizeChange = (size: number) => {
    if (!editorCanEdit) return;

    const applied = applyTextSizeToSelection(size);
    setTextSize(size);
    if (!applied) {
      applyTextSizeToCaret(size);
    }
    resetTypingHistorySession();
    commitHistory("push");
    editorRef.current?.focus();
  };

  useEffect(() => {
    // Load document content if editing - with delay to ensure ref is ready
    const loadContent = () => {
      if (!editorRef.current) {
        return;
      }

      if (!editingDocument) {
        return;
      }

      if (!editingDocument.html) {
        return;
      }
      // Check if the saved HTML contains the full editor div (old format)
      if (
        editingDocument.html.includes('contenteditable="true"') ||
        editingDocument.html.includes("contentEditable")
      ) {
        // Old format: parse and extract content
        const parser = new DOMParser();
        const doc = parser.parseFromString(editingDocument.html, "text/html");
        const editorContent = doc.querySelector('[contenteditable="true"]');

        if (editorContent) {
          editorRef.current.innerHTML = editorContent.innerHTML;
        } else {
          editorRef.current.innerHTML = editingDocument.html;
        }
      } else {
        // New format: simply load the innerHTML directly
        editorRef.current.innerHTML = editingDocument.html;
      }
    };

    // Try to load immediately
    loadContent();

    // Also try after a short delay in case the ref wasn't ready
    const timeoutId = setTimeout(() => {
      loadContent();

      // Focus logic
      if (editorRef.current) {
        editorRef.current.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
        savedRangeRef.current = range.cloneRange();
        initializeHistory();
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [editingDocument, isLoadingDocument]);

  // Pre-cache PNGs for all SVG icons loaded from saved documents
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const cacheExistingIcons = () => {
      const icons = editor.querySelectorAll(".svg-icon");
      icons.forEach((icon) => {
        const el = icon as HTMLElement;
        if (el.dataset.id && !pngCacheRef.current.has(el.dataset.id)) {
          scheduleCachePng(el);
        }
      });
    };

    const timerId = setTimeout(cacheExistingIcons, 300);
    return () => clearTimeout(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDocument, isLoadingDocument]);

  // Cancel any pending PNG-cache flush on unmount so we don't leak the
  // queue map or run an idle callback against a torn-down component.
  useEffect(() => {
    const queueRef = pngCacheQueueRef;
    const scheduledRef = pngCacheScheduledRef;
    return () => {
      const handle = scheduledRef.current;
      if (handle !== null) {
        const w = window as Window & {
          cancelIdleCallback?: (h: number) => void;
        };
        if (typeof w.cancelIdleCallback === "function") {
          w.cancelIdleCallback(handle);
        } else {
          window.clearTimeout(handle);
        }
        scheduledRef.current = null;
      }
      queueRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!isFullScreen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsFullScreen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullScreen]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (isFullScreen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullScreen]);

  useEffect(() => {
    if (isFullScreen) {
      editorRef.current?.focus();
    }
  }, [isFullScreen]);

  const updateCartoucheInnerResizeControls = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Remove any existing controls first
    editor
      .querySelectorAll(".cartouche-inner-resize-controls")
      .forEach((el) => el.remove());

    // Add controls only for cartouches in "inner" select mode
    const cartouches = editor.querySelectorAll(
      '.svg-icon.cartouche-wrapper[data-select-mode="inner"]',
    ) as NodeListOf<HTMLElement>;

    cartouches.forEach((wrapper) => {
      const idx = Number(wrapper.dataset.selectedInnerIdx ?? "-1");
      const allInner = wrapper.querySelectorAll(
        ".cartouche-icons-container > svg",
      ) as NodeListOf<SVGSVGElement>;
      if (idx < 0 || idx >= allInner.length) return;
      const innerSvg = allInner[idx];

      // Always use current global iconSize as the baseline.
      // downSteps tracks how many times minus was pressed (persisted on SVG).
      innerSvg.dataset.innerMaxSize = String(iconSize);
      let downSteps = Number(innerSvg.dataset.downSteps) || 0;
      // If no custom size yet, start from global
      if (!innerSvg.dataset.customSize) {
        innerSvg.dataset.customSize = String(iconSize);
      }
      const step = 2;

      const applyLogicalSize = (logicalSize: number) => {
        innerSvg.dataset.customSized = "true";
        innerSvg.dataset.customSize = String(logicalSize);

        const oH = Number(innerSvg.dataset.origH) || iconSize;
        const oW = Number(innerSvg.dataset.origW) || iconSize;
        const fitScale = Number(wrapper.dataset.fitScale) || 0.86;
        const scale = logicalSize / iconSize;

        innerSvg.style.height = `${Math.round(oH * fitScale * scale)}px`;
        innerSvg.style.width = `${Math.round(oW * fitScale * scale)}px`;
      };

      const controls = document.createElement("div");
      controls.className = "cartouche-inner-resize-controls";
      controls.style.cssText = `
        position: absolute;
        left: 50%;
        bottom: 4px;
        transform: translateX(-50%);
        display: flex;
        gap: 4px;
        padding: 2px 4px;
        border-radius: 4px;
        background: rgba(250, 229, 200, 0.95);
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        z-index: 20;
      `;

      const makeButton = (
        label: string,
        onClick: () => void,
      ): HTMLButtonElement => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.style.cssText = `
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 3px;
          padding: 0 6px;
          font-size: 11px;
          line-height: 16px;
          cursor: pointer;
        `;
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        });
        return btn;
      };

      const minusBtn = makeButton("-", () => {
        let logicalSize = Number(innerSvg.dataset.customSize) || iconSize;
        const minSize = 12;
        if (logicalSize <= minSize) return;
        logicalSize = Math.max(minSize, logicalSize - step);
        downSteps += 1;
        innerSvg.dataset.downSteps = String(downSteps);
        applyLogicalSize(logicalSize);
        plusBtn.disabled = false;
        plusBtn.style.opacity = "1";
        plusBtn.style.cursor = "pointer";
      });
      const plusBtn = makeButton("+", () => {
        if (downSteps <= 0) return;
        let logicalSize = Number(innerSvg.dataset.customSize) || iconSize;
        logicalSize = Math.min(iconSize, logicalSize + step);
        applyLogicalSize(logicalSize);
        downSteps -= 1;
        innerSvg.dataset.downSteps = String(Math.max(0, downSteps));
        if (downSteps <= 0) {
          plusBtn.disabled = true;
          plusBtn.style.opacity = "0.4";
          plusBtn.style.cursor = "default";
        }
      });

      // Initially (or after reselect), enable/disable plus according to stored downSteps
      if (downSteps > 0) {
        plusBtn.disabled = false;
        plusBtn.style.opacity = "1";
        plusBtn.style.cursor = "pointer";
      } else {
        plusBtn.disabled = true;
        plusBtn.style.opacity = "0.4";
        plusBtn.style.cursor = "default";
      }

      controls.appendChild(minusBtn);
      controls.appendChild(plusBtn);
      wrapper.style.position = wrapper.style.position || "relative";
      wrapper.appendChild(controls);
    });
  }, [iconSize]);

  useEffect(() => {
    selectedIconsRef.current = selectedIcons;
  }, [selectedIcons]);

  const clearSelectedIcons = useCallback(() => {
    const current = selectedIconsRef.current;
    if (!current.length) return;

    current.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.dataset.cartouche === "true") {
        delete htmlEl.dataset.selectMode;
        delete htmlEl.dataset.selectedInnerIdx;
      }
    });
    setSelectedIcons([]);
  }, []);

  const ensureLeadingSelectionBoundary = useCallback((editor: HTMLElement) => {
    const firstMeaningfulChild = Array.from(editor.childNodes).find((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return true;
      return (node.textContent || "").replace(/\u200B/g, "").length > 0;
    });

    if (!(firstMeaningfulChild instanceof HTMLElement)) return;
    if (!firstMeaningfulChild.classList.contains("svg-icon")) return;

    const firstChild = editor.firstChild as HTMLElement | ChildNode | null;
    if (
      firstChild instanceof HTMLElement &&
      firstChild.dataset.selectionBoundary === "true"
    ) {
      return;
    }

    const marker = document.createElement("span");
    marker.dataset.selectionBoundary = "true";
    marker.textContent = "\u200B";
    // The boundary is a caret-anchor that lives at the very start of the
    // editor when the first child is a glyph. It has to be:
    //   - zero visual width (its only character is U+200B which is itself
    //     zero-width — no extra width clamp needed),
    //   - hidden from copy / paste UI, and
    //   - tall enough that a caret placed inside it has a visible height.
    //
    // Earlier versions clamped `font-size: 0; line-height: 0;` here to
    // prevent the boundary from contributing to line height. The side
    // effect was catastrophic: when the user clicked in the empty space
    // before the first glyph, the browser snapped the caret inside this
    // span and rendered it at 0 px — completely invisible. Worse, any
    // character typed at that caret was inserted as text inside the
    // 0-px-tall span and stayed invisible too. Removing the font-size /
    // line-height overrides keeps the caret visible; the boundary still
    // renders as zero width because the ZWSP is zero-width, and the rest
    // of the line geometry comes from the adjacent glyph anyway.
    marker.style.cssText = `
      display: inline;
      color: transparent;
      user-select: text;
    `;
    editor.insertBefore(marker, firstMeaningfulChild);
  }, []);

  const normalizeEditorArtifacts = useCallback((editor: HTMLElement) => {
    // Strip browser-inserted placeholder <br> elements. Our editor only
    // ever creates `<br data-editor-line-break="true">`; any plain <br>
    // came from Chrome's contentEditable auto-fill — most often after a
    // Backspace empties a leading text node, Chrome drops a placeholder
    // <br> in to maintain the line. That ghost <br> renders as a visible
    // empty line above the glyphs that none of our key handlers
    // recognise as a line break, so the user can't delete it.
    //
    // BUT — when the editor is *genuinely* empty (e.g. user selected all
    // and deleted, or just cleared the doc), Chrome NEEDS that
    // placeholder <br> to render a caret and accept input. Stripping it
    // here would leave a node-less contentEditable that swallows clicks
    // and key events until reload. So we only strip stray <br>s when the
    // editor still has meaningful content surrounding them; if removing
    // it would empty the editor, we keep one to keep the caret alive.
    const hasMeaningfulContent = (): boolean => {
      const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      );
      let node: Node | null = walker.nextNode();
      while (node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.tagName === "BR") {
            node = walker.nextNode();
            continue;
          }
          if (
            el.dataset?.selectionBoundary === "true" ||
            el.dataset?.editorLineSpacer === "true"
          ) {
            node = walker.nextNode();
            continue;
          }
          // Any other element (svg-icon, image, line-break tag, etc.)
          // is real content.
          return true;
        }
        if (node.nodeType === Node.TEXT_NODE) {
          if ((node.textContent || "").replace(/\u200B/g, "").length > 0) {
            return true;
          }
        }
        node = walker.nextNode();
      }
      return false;
    };

    if (hasMeaningfulContent()) {
      Array.from(editor.querySelectorAll("br")).forEach((br) => {
        const el = br as HTMLElement;
        if (el.dataset?.editorLineBreak === "true") return;
        el.remove();
      });
    }

    // Hoist any line breaks / spacers that got trapped inside the hidden
    // selection-boundary span (e.g. if Enter was pressed with the caret inside
    // that span). They would otherwise be invisible and unreachable.
    Array.from(
      editor.querySelectorAll(
        '[data-selection-boundary="true"] br[data-editor-line-break="true"], [data-selection-boundary="true"] [data-editor-line-spacer="true"]',
      ),
    ).forEach((node) => {
      const boundary = (node as HTMLElement).closest(
        '[data-selection-boundary="true"]',
      );
      if (!boundary || !boundary.parentNode) return;
      boundary.parentNode.insertBefore(node, boundary.nextSibling);
    });

    // Promote any text the user typed inside the leading selection-boundary
    // span out to the editor's plain children. Without this, a click in the
    // empty space before the first glyph (which `placeCaretAtPoint` resolves
    // into the boundary span) traps every typed character inside the
    // transparent-coloured boundary, making typing appear to do nothing.
    Array.from(
      editor.querySelectorAll('[data-selection-boundary="true"]'),
    ).forEach((node) => {
      const boundary = node as HTMLElement;
      const parent = boundary.parentNode;
      if (!parent) return;

      const text = (boundary.textContent || "").replace(/\u200B/g, "");
      if (text.length === 0) return; // nothing to promote

      const sel = window.getSelection();
      const caretInside =
        !!sel &&
        sel.rangeCount > 0 &&
        sel.anchorNode != null &&
        boundary.contains(sel.anchorNode);
      const caretNode: Node | null = caretInside ? sel!.anchorNode : null;
      let caretOffset = caretInside ? sel!.anchorOffset : 0;

      // Strip the ZWSPs from each text node in-place (so we don't replace
      // the caret-anchored node) and adjust the caret offset for any
      // ZWSPs removed before it.
      const textNodes: Text[] = [];
      const walker = document.createTreeWalker(boundary, NodeFilter.SHOW_TEXT);
      let cur: Node | null = walker.nextNode();
      while (cur) {
        textNodes.push(cur as Text);
        cur = walker.nextNode();
      }
      textNodes.forEach((t) => {
        if (!t.data.includes("\u200B")) return;
        if (t === caretNode) {
          const before = t.data.substring(0, caretOffset);
          const removedBefore = (before.match(/\u200B/g) || []).length;
          caretOffset -= removedBefore;
        }
        t.data = t.data.replace(/\u200B/g, "");
      });

      // Unwrap the boundary span so the typed text becomes a regular
      // child of the editor. A fresh leading boundary will be re-added
      // by the next `ensureLeadingSelectionBoundary` pass if the first
      // child is still a glyph.
      while (boundary.firstChild) {
        parent.insertBefore(boundary.firstChild, boundary);
      }
      parent.removeChild(boundary);

      if (
        caretInside &&
        caretNode &&
        caretNode.parentNode &&
        sel &&
        (caretNode.nodeType !== Node.TEXT_NODE ||
          (caretNode as Text).data !== undefined)
      ) {
        const len =
          caretNode.nodeType === Node.TEXT_NODE
            ? (caretNode as Text).data.length
            : (caretNode.childNodes.length ?? 0);
        const safeOffset = Math.max(0, Math.min(caretOffset, len));
        try {
          const r = document.createRange();
          r.setStart(caretNode, safeOffset);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          savedRangeRef.current = r.cloneRange();
        } catch {
          // best-effort
        }
      }
    });

    Array.from(
      editor.querySelectorAll('[data-editor-line-spacer="true"]'),
    ).forEach((node) => {
      const spacer = node as HTMLElement;
      const parent = spacer.parentNode;
      if (!parent) return;

      // Icons must not live inside the line spacer: setting textContent below wipes
      // children and deletes them (SVG path data is not counted in text length).
      const hoisted = Array.from(
        spacer.querySelectorAll(":scope > .svg-icon, :scope > img"),
      ) as HTMLElement[];
      let insertAfter: ChildNode = spacer;
      hoisted.forEach((el) => {
        parent.insertBefore(el, insertAfter.nextSibling);
        insertAfter = el;
      });

      const text = (spacer.textContent || "").replace(/\u200B/g, "");

      if (text.length > 0) {
        // The spacer now holds real characters typed by the user. Promote it
        // to plain text. We must NOT replace the underlying text node with a
        // brand new one (as `spacer.replaceWith(createTextNode(...))` would),
        // because the caret is currently anchored to that text node — losing
        // its anchor causes the next typed character to land at the wrong
        // position (e.g. typing "hello" produces "elloh"). Instead we strip
        // the ZWSP in-place and unwrap the span so the same text node
        // survives, with caret offsets adjusted for any ZWSPs removed before
        // the caret.
        const sel = window.getSelection();
        const caretInside =
          !!sel &&
          sel.rangeCount > 0 &&
          sel.anchorNode != null &&
          spacer.contains(sel.anchorNode);
        const caretNode: Node | null = caretInside ? sel!.anchorNode : null;
        let caretOffset = caretInside ? sel!.anchorOffset : 0;

        const textNodes: Text[] = [];
        const walker = document.createTreeWalker(spacer, NodeFilter.SHOW_TEXT);
        let cur: Node | null = walker.nextNode();
        while (cur) {
          textNodes.push(cur as Text);
          cur = walker.nextNode();
        }
        textNodes.forEach((t) => {
          if (!t.data.includes("\u200B")) return;
          if (t === caretNode) {
            const before = t.data.substring(0, caretOffset);
            const removedBefore = (before.match(/\u200B/g) || []).length;
            caretOffset -= removedBefore;
          }
          t.data = t.data.replace(/\u200B/g, "");
        });

        // Unwrap the spacer span into its parent, preserving the same
        // child nodes (and thus the caret anchor).
        while (spacer.firstChild) {
          parent.insertBefore(spacer.firstChild, spacer);
        }
        parent.removeChild(spacer);

        if (
          caretInside &&
          caretNode &&
          caretNode.parentNode &&
          sel &&
          (caretNode.nodeType !== Node.TEXT_NODE ||
            (caretNode as Text).data !== undefined)
        ) {
          const len =
            caretNode.nodeType === Node.TEXT_NODE
              ? (caretNode as Text).data.length
              : (caretNode.childNodes.length ?? 0);
          const safeOffset = Math.max(0, Math.min(caretOffset, len));
          try {
            const r = document.createRange();
            r.setStart(caretNode, safeOffset);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            savedRangeRef.current = r.cloneRange();
          } catch {
            // Caret restore is best-effort; if the node is no longer valid
            // we silently leave the browser's default selection in place.
          }
        }
        return;
      }

      spacer.textContent = "\u200B";
    });

    // Enforce spacer usage per visual line (lines are separated by <br data-editor-line-break>):
    // - Spacers are ONLY for truly empty lines (caret landing spot).
    // - If the line has real content (icons/text), remove spacers entirely.
    // - If the line is empty, ensure exactly one spacer at the start.
    const children = Array.from(editor.childNodes);
    let lineStartIdx = 0;
    const isManualBr = (n: ChildNode | null) =>
      n instanceof HTMLElement &&
      n.tagName === "BR" &&
      n.getAttribute("data-editor-line-break") === "true";

    const isSpacer = (n: ChildNode | null) =>
      n instanceof HTMLElement &&
      n.getAttribute("data-editor-line-spacer") === "true";

    const isIgnorable = (n: ChildNode) => {
      if (isSpacer(n)) return true;
      if (
        n instanceof HTMLElement &&
        n.getAttribute("data-selection-boundary") === "true"
      )
        return true;
      if (n.nodeType === Node.TEXT_NODE) {
        return (n.textContent || "").replace(/\u200B/g, "").trim() === "";
      }
      return false;
    };

    for (let i = 0; i <= children.length; i++) {
      const atEnd = i === children.length;
      const brHere = !atEnd && isManualBr(children[i]);
      if (!atEnd && !brHere) continue;

      const lineEndIdx = i; // exclusive (br at i is separator)
      const segment = children.slice(lineStartIdx, lineEndIdx);

      const spacers = segment.filter(
        (n): n is HTMLElement => n instanceof HTMLElement && isSpacer(n),
      );
      const hasRealContent = segment.some((n) => !isIgnorable(n));

      if (hasRealContent) {
        // Non-empty line: remove interior spacers, but keep/add ONE caret
        // anchor at the start if the line begins with a non-editable element
        // (icon/img). Otherwise the caret has nowhere to land before the icon.
        const firstRealNode = segment.find((n) => !isIgnorable(n));
        const startsWithNonEditable =
          firstRealNode instanceof HTMLElement &&
          (firstRealNode.classList.contains("svg-icon") ||
            firstRealNode.tagName === "IMG");

        if (startsWithNonEditable) {
          // Drop empty / ZWSP-only text nodes that appear *before* the
          // first real element on this line. They're invisible noise
          // left behind by Backspace cycles inside spacer/boundary
          // spans, and leaving them in place causes the spacer
          // enforcement to keep adding fresh spacers on every input,
          // which manifests as "extra empty lines" the user can't
          // delete cleanly. Track whether the caret is currently
          // anchored to one of those text nodes so we can re-anchor
          // it onto the spacer instead of letting Chrome orphan it
          // (an orphaned caret often triggers Chrome to insert a
          // placeholder <br>, which would render as the very ghost
          // empty line we're trying to prevent).
          const sel = window.getSelection();
          let caretWasInRemoved = false;
          if (sel && sel.rangeCount > 0) {
            const r0 = sel.getRangeAt(0);
            if (
              r0.collapsed &&
              r0.startContainer.nodeType === Node.TEXT_NODE &&
              segment.indexOf(r0.startContainer as ChildNode) >= 0 &&
              r0.startContainer !== firstRealNode &&
              (r0.startContainer.textContent || "").replace(/\u200B/g, "")
                .length === 0
            ) {
              caretWasInRemoved = true;
            }
          }

          segment.forEach((n) => {
            if (n === firstRealNode) return;
            if (
              n.nodeType === Node.TEXT_NODE &&
              (n.textContent || "").replace(/\u200B/g, "").length === 0
            ) {
              n.parentNode?.removeChild(n);
            }
          });

          let keep: HTMLElement | null = null;
          if (spacers.length) {
            keep = spacers[0];
            spacers.slice(1).forEach((s) => s.remove());
          } else {
            keep = document.createElement("span");
            keep.setAttribute("data-editor-line-spacer", "true");
            keep.textContent = "\u200B";
          }
          editor.insertBefore(keep, firstRealNode);

          if (caretWasInRemoved && sel) {
            const spacerText = keep.firstChild as Node | null;
            if (spacerText && spacerText.nodeType === Node.TEXT_NODE) {
              try {
                const r = document.createRange();
                r.setStart(
                  spacerText,
                  (spacerText.textContent || "").length,
                );
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
                savedRangeRef.current = r.cloneRange();
              } catch {
                // Best-effort caret restore.
              }
            }
          }
        } else {
          spacers.forEach((s) => s.remove());
        }
      } else {
        // Empty line: keep/ensure a single spacer at the start.
        let keep: HTMLElement | null = null;
        if (spacers.length) {
          keep = spacers[0];
          spacers.slice(1).forEach((s) => s.remove());
        } else {
          keep = document.createElement("span");
          keep.setAttribute("data-editor-line-spacer", "true");
          keep.textContent = "\u200B";
        }

        const insertBeforeNode =
          lineStartIdx < children.length ? children[lineStartIdx] : null;
        editor.insertBefore(keep, insertBeforeNode);
      }

      lineStartIdx = i + 1; // skip the br itself
    }

    const firstMarker = editor.querySelector(
      ':scope > [data-selection-boundary="true"]',
    ) as HTMLElement | null;

    Array.from(
      editor.querySelectorAll('[data-selection-boundary="true"]'),
    ).forEach((node) => {
      if (node !== firstMarker) {
        node.remove();
      }
    });
  }, []);

  useEffect(() => {
    document.querySelectorAll(".svg-icon").forEach((icon) => {
      const el = icon as HTMLElement;
      el.style.backgroundColor = "";
      el.style.outline = "";
      el.style.outlineOffset = "";
      if (el.dataset.cartouche === "true") {
        el.querySelectorAll(".cartouche-icons-container svg").forEach((svg) => {
          (svg as HTMLElement).style.backgroundColor = "";
          (svg as HTMLElement).style.outline = "";
        });
      }
    });
    selectedIcons.forEach((icon) => {
      const el = icon as HTMLElement;
      if (
        el.dataset.cartouche === "true" &&
        el.dataset.selectMode === "inner"
      ) {
        const idx = Number(el.dataset.selectedInnerIdx ?? "-1");
        const allInner = el.querySelectorAll(
          ".cartouche-icons-container > svg",
        );
        if (idx >= 0 && idx < allInner.length) {
          (allInner[idx] as HTMLElement).style.backgroundColor = "#0074ffcc";
        }
      } else {
        el.style.backgroundColor = "#0074ffcc";
      }
    });
    setSelectedIconCount(selectedIcons.length);
    // Track single icon selection for shading
    if (selectedIcons.length === 1) {
      const iconEl = selectedIcons[0] as HTMLElement;
      setSelectedSingleIcon(iconEl);
      const hasShading = !!iconEl.querySelector(".shading-overlay");
      setSelectedIconHasShading(hasShading);
    } else {
      setSelectedSingleIcon(null);
      setSelectedIconHasShading(false);
    }
    // Reflect the selection's rotation in the toolbar dial. If multiple
    // icons are selected with the same rotation we surface that value;
    // a mixed selection collapses to 0 so the dial / preset highlight
    // doesn't lie about a single-source-of-truth angle.
    if (selectedIcons.length > 0) {
      const angles = selectedIcons.map((n) =>
        normalizeAngle(Number((n as HTMLElement).dataset.rotation || "0")),
      );
      const allEqual = angles.every((a) => a === angles[0]);
      setSelectedIconRotation(allEqual ? angles[0] : 0);
    } else {
      setSelectedIconRotation(0);
    }
    // Refresh inner cartouche +/- controls
    updateCartoucheInnerResizeControls();
  }, [selectedIcons, iconSize, updateCartoucheInnerResizeControls]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const editor = editorRef.current;
      if (!editor) return;
      const t = e.target as HTMLElement;
      // Don't clear selection when modal is open
      if (showShadingOptions || showMagicBox) return;
      if (t && t.closest("[data-keep-selection]")) return;
      // If any <select> is clicked outside the editor, clear selection immediately
      const isSelect = !!t.closest("select");
      if (isSelect && !editor.contains(t)) {
        if (selectedIconsRef.current.length) setSelectedIcons([]);
        return;
      }
      if (
        !editor.contains(e.target as Node) &&
        selectedIconsRef.current.length
      ) {
        clearSelectedIcons();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [clearSelectedIcons, showShadingOptions, showMagicBox]);

  useEffect(() => {
    const onSelectionChange = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;
      ensureLeadingSelectionBoundary(editor);
      const fragment = range.cloneContents();
      const mergedGroups = Array.from(
        fragment.querySelectorAll(".svg-icon.merged"),
      );
      const standaloneIcons = Array.from(
        fragment.querySelectorAll(".svg-icon"),
      ).filter((n) => {
        const el = n as HTMLElement;
        if (el.classList.contains("merged")) return false;
        if (el.closest(".svg-icon.merged")) return false;
        return true;
      });
      const selectedInFragment = [...mergedGroups, ...standaloneIcons];
      const rangeIcons = selectedInFragment.length;
      const explicit = selectedIcons.length;
      setSelectedIconCount(Math.max(explicit, rangeIcons));
      document.querySelectorAll(".svg-icon").forEach((icon) => {
        const el = icon as HTMLElement;
        el.style.backgroundColor = "";
      });
      if (rangeIcons > 0) {
        const realIcons: HTMLElement[] = [];
        selectedInFragment.forEach((icon) => {
          const id = (icon as HTMLElement).dataset.id;
          if (id) {
            const realIcon = editor.querySelector(
              `.svg-icon[data-id="${id}"]`,
            ) as HTMLElement | null;
            if (realIcon) {
              realIcon.style.backgroundColor = "#3b82f6";
              realIcons.push(realIcon);
            }
          }
        });
        // Mirror the explicit-selection rotation logic for range
        // selections so the Rotate dial reflects whichever path the
        // user is currently driving.
        if (explicit === 0 && realIcons.length > 0) {
          const angles = realIcons.map((el) =>
            normalizeAngle(Number(el.dataset.rotation || "0")),
          );
          const allEqual = angles.every((a) => a === angles[0]);
          setSelectedIconRotation(allEqual ? angles[0] : 0);
        }
      } else if (explicit === 0) {
        setSelectedIconRotation(0);
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [selectedIcons, ensureLeadingSelectionBoundary]);

  useEffect(() => {
    if (selectedIcons.length > 0) {
      setSelectedIconCount(selectedIcons.length);
      document.querySelectorAll(".svg-icon").forEach((icon) => {
        const el = icon as HTMLElement;
        el.style.backgroundColor = "";
      });
      selectedIcons.forEach((icon) => {
        const el = icon as HTMLElement;
        if (
          el.dataset.cartouche === "true" &&
          el.dataset.selectMode === "inner"
        ) {
          const idx = Number(el.dataset.selectedInnerIdx ?? "-1");
          const allInner = el.querySelectorAll(
            ".cartouche-icons-container > svg",
          );
          if (idx >= 0 && idx < allInner.length) {
            (allInner[idx] as HTMLElement).style.backgroundColor = "#0074ffcc";
          }
        } else {
          el.style.backgroundColor = "#0074ffcc";
        }
      });
    }
  }, [selectedIcons]);

  // Save the latest caret position inside the editor for later restoration
  useEffect(() => {
    const onSaveRange = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;
      savedRangeRef.current = range.cloneRange();
    };
    document.addEventListener("selectionchange", onSaveRange);
    return () => document.removeEventListener("selectionchange", onSaveRange);
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    return;
  }, []);

  const restoreSavedRangeIfNeeded = () => {
    const editor = editorRef.current;
    if (!editor) return false;
    const sel = window.getSelection();
    const hasValidSelection = !!(
      sel &&
      sel.rangeCount > 0 &&
      editor.contains(sel.getRangeAt(0).commonAncestorContainer)
    );
    if (hasValidSelection) return true;
    if (savedRangeRef.current) {
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(savedRangeRef.current);
      return true;
    }
    return false;
  };

  const scrollElementIntoView = (element: Node) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      if (element instanceof HTMLElement) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
      } else {
        // For text nodes, scroll the parent element
        const parent = element.parentElement;
        if (parent) {
          parent.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
        }
      }
    });
  };

  // Place a collapsed caret at the given screen point inside the editor.
  //
  // We can't trust the browser's `caretPositionFromPoint` /
  // `caretRangeFromPoint` for clicks in the margin gap between two atomic
  // inline-block glyphs: when the click misses every text node, the
  // browser falls back to the nearest *text node* on the line, which in
  // our editor is usually the trailing line-spacer ZWSP. That's why a
  // click between glyph 1 and glyph 2 sometimes surfaces the caret
  // between glyph 2 and 3, or near the end of the line.
  //
  // Instead, we do our own hit-test against the rendered glyph rects:
  // find the glyph (or gap) under (x, y) and place the caret at the
  // corresponding (parent, offset). This makes "click between two
  // glyphs" land exactly between those glyphs.
  const placeCaretAtPoint = (clientX: number, clientY: number) => {
    const editor = editorRef.current;
    if (!editor) return false;

    // Top-level glyph atoms (skip nested glyphs inside merged groups
    // and cartouche children — those are decorative).
    const topLevelGlyphs = Array.from(
      editor.querySelectorAll<HTMLElement>(".svg-icon"),
    ).filter((el) => !el.parentElement?.closest(".svg-icon"));

    // Glyphs whose vertical band the click is on. Use a small slop so
    // clicks in the inter-line margin still snap to the nearest line.
    const inLine = topLevelGlyphs
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => clientY >= rect.top - 4 && clientY <= rect.bottom + 4)
      .sort((a, b) => a.rect.left - b.rect.left);

    let node: Node | null = null;
    let offset = 0;

    if (inLine.length > 0) {
      // Walk the line left-to-right; place caret at the first gap whose
      // right boundary is past the click x.
      let target: HTMLElement | null = null;
      let side: "before" | "after" = "before";

      for (const { el, rect } of inLine) {
        if (clientX < rect.left) {
          // Click is in the gap *before* this glyph.
          target = el;
          side = "before";
          break;
        }
        if (clientX <= rect.right) {
          // Click is inside this glyph — pick the closer edge.
          target = el;
          side = clientX < (rect.left + rect.right) / 2 ? "before" : "after";
          break;
        }
      }

      if (!target) {
        // Click is past the last glyph on this line.
        const last = inLine[inLine.length - 1];
        target = last.el;
        side = "after";
      }

      const parent = target.parentNode;
      if (parent) {
        const idx = Array.from(parent.childNodes).indexOf(target as ChildNode);
        if (idx >= 0) {
          node = parent;
          offset = side === "before" ? idx : idx + 1;

          // Special case: clicking the empty space before the first glyph
          // of the editor's first line. We have a leading
          // `data-selection-boundary` span there that exists precisely so
          // the caret has somewhere to land. Anchor INSIDE its text node
          // (at the end of its U+200B) instead of at (editor, idx) — at
          // an element-boundary offset Chrome would either snap the
          // caret somewhere unpredictable or render it 0px tall and the
          // user would think the click did nothing.
          if (side === "before" && parent === editor) {
            const prevSibling = target.previousSibling;
            if (
              prevSibling instanceof HTMLElement &&
              prevSibling.dataset.selectionBoundary === "true" &&
              prevSibling.firstChild &&
              prevSibling.firstChild.nodeType === Node.TEXT_NODE
            ) {
              const txt = prevSibling.firstChild as Text;
              node = txt;
              offset = txt.data.length;
            }
          }
        }
      }
    }

    // No glyphs on this line (or hit-test failed): fall back to the
    // browser's caret resolver, which is correct for plain-text lines.
    if (!node) {
      type CaretPositionFromPoint = (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
      const docWithCp = document as Document & {
        caretPositionFromPoint?: CaretPositionFromPoint;
      };

      if (typeof docWithCp.caretPositionFromPoint === "function") {
        const pos = docWithCp.caretPositionFromPoint(clientX, clientY);
        if (pos) {
          node = pos.offsetNode;
          offset = pos.offset;
        }
      } else if (typeof document.caretRangeFromPoint === "function") {
        const range = document.caretRangeFromPoint(clientX, clientY);
        if (range) {
          node = range.startContainer;
          offset = range.startOffset;
        }
      }
    }

    if (!node || !editor.contains(node)) return false;

    const sel = window.getSelection();
    if (!sel) return false;
    try {
      const range = document.createRange();
      range.setStart(node, offset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  };

  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    pointerDownPointRef.current = { x: e.clientX, y: e.clientY };
    isPointerDraggingRef.current = false;
    suppressEditorClickRef.current = false;

    const target = e.target as HTMLElement;
    const atom = target.closest(".svg-icon") as HTMLElement | null;

    // Cartouche atoms keep the browser's default mousedown handling and
    // their click-to-toggle workflow (inner-glyph selection for resize /
    // customization).
    if (atom && atom.dataset.cartouche === "true") {
      return;
    }

    // We only override the browser's caret/drag handling when the click
    // is on or next to a glyph atom — that's where the browser's
    // hit-test for atomic inline-blocks is unreliable. For plain-text
    // lines we let the browser handle everything natively, otherwise
    // calling preventDefault here would kill normal drag-selection of
    // text.
    const editor = editorRef.current;
    let needsTakeover = !!atom;
    if (!needsTakeover && editor) {
      const topLevelGlyphs = Array.from(
        editor.querySelectorAll<HTMLElement>(".svg-icon"),
      ).filter((el) => !el.parentElement?.closest(".svg-icon"));
      needsTakeover = topLevelGlyphs.some((el) => {
        const r = el.getBoundingClientRect();
        return e.clientY >= r.top - 4 && e.clientY <= r.bottom + 4;
      });
    }

    if (!needsTakeover) {
      // Pure plain-text click — let the browser focus, place caret, and
      // start drag-selection on its own.
      if (!atom) clearSelectedIcons();
      return;
    }

    e.preventDefault();
    editor?.focus({ preventScroll: true });
    placeCaretAtPoint(e.clientX, e.clientY);

    if (!atom) {
      clearSelectedIcons();
    }
  };

  const handleEditorMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const start = pointerDownPointRef.current;
    if (!start) return;

    const justStartedDrag =
      !isPointerDraggingRef.current &&
      (Math.abs(e.clientX - start.x) > 4 ||
        Math.abs(e.clientY - start.y) > 4);

    if (justStartedDrag) {
      isPointerDraggingRef.current = true;
      suppressEditorClickRef.current = true;
      // Starting a fresh range selection; drop any prior icon-selection state
      // so the Group/Cartouche buttons see a clean slate driven by the range.
      if (selectedIconsRef.current.length > 0) {
        clearSelectedIcons();
      }
    }

    if (!isPointerDraggingRef.current) return;
    if (e.buttons !== 1) return;

    // ----- Glyph-aware drag selection -----
    //
    // The browser's native drag-selection treats each glyph as an atom
    // and only flips focus to the far side of the atom once the cursor
    // crosses its *midpoint*. With 30-40px glyphs that's perceptibly
    // laggy, and in the gap between two glyphs the focus can even flip
    // back, dropping the previously-selected glyph until the cursor
    // reaches the next one.
    //
    // We replace that with: for every glyph on the cursor's line, decide
    // membership in the selection by:
    //
    //   1. The glyph is on the OPPOSITE side of the anchor from the
    //      cursor in document order.
    //   2. The cursor has crossed the glyph's outer edge (the far edge
    //      from the anchor along the line direction).
    //
    // The line direction is X for plain horizontal text and Y for content
    // inside a `.vertical-run`. Snap selection focus to the far edge of
    // the OUTERMOST such glyph in the dragging direction.
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const anchorNode = sel.anchorNode;
    if (!anchorNode || !editor.contains(anchorNode)) return;
    const anchorOffset = sel.anchorOffset;

    const cursorX = e.clientX;
    const cursorY = e.clientY;

    // Detect line orientation from the anchor's context — vertical when
    // anchor lives inside a `.vertical-run`. Direction is computed along
    // the line axis (X for horizontal, Y for vertical), and the
    // perpendicular axis is used to filter glyphs to the same line.
    const anchorEl =
      anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as Element)
        : anchorNode.parentElement;
    const verticalLine = !!anchorEl?.closest(".vertical-run");

    const cursorAlong = verticalLine ? cursorY : cursorX;
    const cursorPerp = verticalLine ? cursorX : cursorY;
    const startAlong = verticalLine ? start.y : start.x;
    const extendingForward = cursorAlong >= startAlong;

    // True iff the glyph comes after the selection anchor in document order.
    const isGlyphAfterAnchor = (g: HTMLElement): boolean => {
      if (anchorNode === g.parentNode) {
        const idx = Array.from(anchorNode.childNodes).indexOf(g as ChildNode);
        return idx >= anchorOffset;
      }
      const cmp = anchorNode.compareDocumentPosition(g);
      if (cmp & Node.DOCUMENT_POSITION_FOLLOWING) return true;
      if (cmp & Node.DOCUMENT_POSITION_PRECEDING) return false;
      if (cmp & Node.DOCUMENT_POSITION_CONTAINS) {
        let cur: Node | null = g;
        while (cur && cur.parentNode !== anchorNode) cur = cur.parentNode;
        if (cur && cur.parentNode === anchorNode) {
          const idx = Array.from(anchorNode.childNodes).indexOf(
            cur as ChildNode,
          );
          return idx >= anchorOffset;
        }
      }
      return false;
    };

    // Top-level glyphs only — skip nested glyphs inside merged groups or
    // cartouche wrappers (those are decorative children of the atom).
    const topLevelGlyphs = Array.from(
      editor.querySelectorAll<HTMLElement>(".svg-icon"),
    ).filter((el) => !el.parentElement?.closest(".svg-icon"));

    // Restrict to glyphs whose perpendicular-axis band contains the
    // cursor — i.e. the cursor is on the same line as the glyph.
    const glyphsInLine = topLevelGlyphs.filter((el) => {
      const r = el.getBoundingClientRect();
      const perpStart = verticalLine ? r.left : r.top;
      const perpEnd = verticalLine ? r.right : r.bottom;
      return cursorPerp >= perpStart - 4 && cursorPerp <= perpEnd + 4;
    });

    if (glyphsInLine.length === 0) return;

    let bestGlyph: HTMLElement | null = null;
    let bestEdge = extendingForward ? -Infinity : Infinity;

    for (const g of glyphsInLine) {
      const r = g.getBoundingClientRect();
      const alongStart = verticalLine ? r.top : r.left;
      const alongEnd = verticalLine ? r.bottom : r.right;
      const afterAnchor = isGlyphAfterAnchor(g);
      if (extendingForward) {
        // Glyphs after the anchor that the cursor has reached the near
        // edge of (left for horizontal, top for vertical).
        if (afterAnchor && cursorAlong >= alongStart) {
          if (alongStart > bestEdge) {
            bestEdge = alongStart;
            bestGlyph = g;
          }
        }
      } else {
        // Glyphs before the anchor that the cursor has reached the near
        // edge of (right for horizontal, bottom for vertical).
        if (!afterAnchor && cursorAlong <= alongEnd) {
          if (alongEnd < bestEdge) {
            bestEdge = alongEnd;
            bestGlyph = g;
          }
        }
      }
    }

    if (!bestGlyph) return;

    const parent = bestGlyph.parentNode;
    if (!parent) return;
    const idx = Array.from(parent.childNodes).indexOf(bestGlyph as ChildNode);
    if (idx < 0) return;
    const focusOffset = extendingForward ? idx + 1 : idx;

    try {
      sel.setBaseAndExtent(anchorNode, anchorOffset, parent, focusOffset);
    } catch {
      // Some node combinations can't be selection endpoints; best-effort.
    }
  };

  const handleEditorMouseUp = () => {
    pointerDownPointRef.current = null;
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressEditorClickRef.current || isPointerDraggingRef.current) {
      suppressEditorClickRef.current = false;
      isPointerDraggingRef.current = false;
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;
    const target = e.target as HTMLElement;
    const icon = target.closest(".svg-icon") as HTMLElement | null;
    if (icon && editor.contains(icon)) {
      const mergedParent = icon.closest(
        ".svg-icon.merged",
      ) as HTMLElement | null;
      const iconToSelect = mergedParent || icon;

      // Cartouches keep their click-to-select-inner-glyph workflow because
      // it's the only way to operate on (resize, customize) one specific
      // glyph inside a cartouche. Everything else: a single click should
      // behave exactly like clicking text — let the browser place the caret
      // and don't toggle anything into selectedIcons. Multi-glyph operations
      // (Group, Cartouche, etc.) are driven by drag-selection ranges.
      if (iconToSelect.dataset.cartouche === "true") {
        e.preventDefault();
        const innerSvg = target.closest(
          ".cartouche-icons-container svg",
        ) as SVGElement | null;
        const alreadySelected = selectedIcons.includes(iconToSelect);

        if (innerSvg) {
          const allInner = Array.from(
            iconToSelect.querySelectorAll(".cartouche-icons-container > svg"),
          );
          const idx = allInner.indexOf(innerSvg);
          const idxStr = String(idx);
          const currentMode = iconToSelect.dataset.selectMode;
          const currentIdx = iconToSelect.dataset.selectedInnerIdx;

          // Toggle off when clicking the same inner SVG again
          if (
            alreadySelected &&
            currentMode === "inner" &&
            currentIdx === idxStr
          ) {
            delete iconToSelect.dataset.selectMode;
            delete iconToSelect.dataset.selectedInnerIdx;
            setSelectedIcons(selectedIcons.filter((el) => el !== iconToSelect));
            return;
          }

          iconToSelect.dataset.selectMode = "inner";
          iconToSelect.dataset.selectedInnerIdx = idxStr;
        } else {
          const currentMode = iconToSelect.dataset.selectMode;

          // Toggle off when clicking the cartouche body while it's already selected as cartouche
          if (alreadySelected && currentMode === "cartouche") {
            delete iconToSelect.dataset.selectMode;
            delete iconToSelect.dataset.selectedInnerIdx;
            setSelectedIcons(selectedIcons.filter((el) => el !== iconToSelect));
            return;
          }

          iconToSelect.dataset.selectMode = "cartouche";
          delete iconToSelect.dataset.selectedInnerIdx;
        }

        if (!alreadySelected) {
          setSelectedIcons([...selectedIcons, iconToSelect]);
        } else {
          // Force re-render to update highlighting but keep selection
          setSelectedIcons([...selectedIcons]);
        }
        return;
      }

      // Plain glyph or merged group: behave like clicking text. Drop any
      // lingering icon-selection state and let the browser place the caret
      // at the natural position (no preventDefault).
      if (selectedIcons.length > 0) {
        clearSelectedIcons();
      }
      return;
    }
    clearSelectedIcons();
  };
  const getClosestListItem = (node: Node | null) => {
    if (!node) return null;
    const el = node instanceof Element ? node : node.parentElement;
    return (el?.closest("li") as HTMLLIElement | null) || null;
  };

  const isListItemEmpty = (li: HTMLLIElement) => {
    if (li.querySelector(".svg-icon")) return false;
    const text = (li.textContent || "").replace(/\u200B/g, "").trim();
    const hasOnlyBr =
      li.childNodes.length === 1 && li.childNodes[0].nodeName === "BR";
    return text === "" || hasOnlyBr;
  };

  const getSelectionInEditor = (editor: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    return { sel, range };
  };

  const normalizeSelectableIcon = (icon: HTMLElement | null) => {
    if (!icon) return null;
    const mergedParent = icon.closest(".svg-icon.merged") as HTMLElement | null;
    return mergedParent || icon;
  };

  const getDeepBoundaryNode = (
    node: Node,
    direction: "backward" | "forward",
  ): Node => {
    let current = node;
    while (
      current.childNodes.length > 0 &&
      !(
        current instanceof HTMLElement && current.classList.contains("svg-icon")
      )
    ) {
      current =
        direction === "backward"
          ? current.childNodes[current.childNodes.length - 1]
          : current.childNodes[0];
    }
    return current;
  };

  const getAdjacentNodeFromRange = (
    editor: HTMLElement,
    range: Range,
    direction: "backward" | "forward",
  ): Node | null => {
    const container = range.startContainer;
    const offset = range.startOffset;

    if (container.nodeType === Node.ELEMENT_NODE) {
      const element = container as Element;
      if (direction === "backward" && offset > 0) {
        return getDeepBoundaryNode(element.childNodes[offset - 1], direction);
      }
      if (direction === "forward" && offset < element.childNodes.length) {
        return getDeepBoundaryNode(element.childNodes[offset], direction);
      }
    }

    if (container.nodeType === Node.TEXT_NODE) {
      const text = container.textContent ?? "";
      if (direction === "backward" && offset > 0) return null;
      if (direction === "forward" && offset < text.length) return null;
    }

    let current: Node | null = container;
    while (current && current !== editor) {
      const sibling =
        direction === "backward"
          ? current.previousSibling
          : current.nextSibling;
      if (sibling) {
        return getDeepBoundaryNode(sibling, direction);
      }
      current = current.parentNode;
    }

    return null;
  };

  const getAdjacentSvgIconAtCaret = (
    editor: HTMLElement,
    range: Range,
    direction: "backward" | "forward",
  ) => {
    if (!range.collapsed) return null;
    const node = getAdjacentNodeFromRange(editor, range, direction);
    if (!node) return null;
    const element = node instanceof Element ? node : node.parentElement;
    const icon = element?.closest(".svg-icon") as HTMLElement | null;
    if (!icon || !editor.contains(icon)) return null;
    return normalizeSelectableIcon(icon);
  };

  // Returns true iff there is something the user would consider "real
  // content" between the caret and the chosen edge of the editor. The
  // leading data-selection-boundary span, line-spacer ZWSPs, and pure
  // whitespace text nodes don't count — those are caret anchors, not
  // content. We use this to swallow Backspace at the very start of the
  // editor (and Delete at the very end), because Chrome's default
  // behaviour at those edges is to delete the adjacent atomic inline
  // element (i.e. eat your first/last glyph).
  const hasMeaningfulContentOnSide = (
    editor: HTMLElement,
    range: Range,
    direction: "backward" | "forward",
  ): boolean => {
    if (!range.collapsed) return true;

    const isIgnorableNode = (n: Node | null): boolean => {
      if (!n) return false;
      if (
        n instanceof HTMLElement &&
        (n.dataset?.selectionBoundary === "true" ||
          n.dataset?.editorLineSpacer === "true")
      ) {
        return true;
      }
      if (n.nodeType === Node.TEXT_NODE) {
        return (n.textContent || "").replace(/\u200B/g, "").length === 0;
      }
      return false;
    };

    const container = range.startContainer;
    const offset = range.startOffset;

    // Same node first: any non-ZWSP characters on the relevant side of
    // the caret in the current text node count as content.
    if (container.nodeType === Node.TEXT_NODE) {
      const text = container.textContent || "";
      const slice =
        direction === "backward"
          ? text.substring(0, offset)
          : text.substring(offset);
      if (slice.replace(/\u200B/g, "").length > 0) return true;
    } else if (container.nodeType === Node.ELEMENT_NODE) {
      const element = container as Element;
      const childs = Array.from(element.childNodes);
      const range =
        direction === "backward"
          ? childs.slice(0, offset)
          : childs.slice(offset);
      for (const child of range) {
        if (!isIgnorableNode(child)) return true;
      }
    }

    // Walk up the tree, checking siblings on the relevant side at each
    // level. The first non-ignorable sibling we find is real content.
    let current: Node | null = container;
    while (current && current !== editor) {
      let sib =
        direction === "backward"
          ? current.previousSibling
          : current.nextSibling;
      while (sib) {
        if (!isIgnorableNode(sib)) return true;
        sib =
          direction === "backward" ? sib.previousSibling : sib.nextSibling;
      }
      current = current.parentNode;
    }

    return false;
  };

  const removeAdjacentSvgIcon = (
    editor: HTMLElement,
    range: Range,
    direction: "backward" | "forward",
  ) => {
    const icon = getAdjacentSvgIconAtCaret(editor, range, direction);
    if (!icon) return false;

    const isIgnorableNode = (n: Node): boolean => {
      if (
        n instanceof HTMLElement &&
        (n.dataset?.selectionBoundary === "true" ||
          n.dataset?.editorLineSpacer === "true")
      )
        return true;
      if (n.nodeType === Node.TEXT_NODE) {
        return (n.textContent || "").replace(/\u200B/g, "").trim().length === 0;
      }
      return false;
    };

    // Find the manual <br> that starts the line containing this icon (if any)
    // and whether the icon is the only real content on that line. When the user
    // deletes the last icon of a line, we keep the <br> so the line itself
    // survives as an empty line (so the caret can stay there to keep writing),
    // and we make sure a ZWSP spacer acts as the caret anchor.
    let brBefore: HTMLBRElement | null = null;
    let sib: Node | null = icon.previousSibling;
    while (sib) {
      if (
        sib instanceof HTMLBRElement &&
        sib.dataset.editorLineBreak === "true"
      ) {
        brBefore = sib;
        break;
      }
      if (sib instanceof HTMLElement && sib.classList.contains("svg-icon"))
        break;
      if (!isIgnorableNode(sib)) break;
      sib = sib.previousSibling;
    }

    let iconIsSoleOnLine = false;
    if (brBefore) {
      iconIsSoleOnLine = true;
      let n: Node | null = brBefore.nextSibling;
      while (n) {
        if (n instanceof HTMLBRElement && n.dataset?.editorLineBreak === "true")
          break;
        if (n !== icon && !isIgnorableNode(n)) {
          iconIsSoleOnLine = false;
          break;
        }
        n = n.nextSibling;
      }
    }

    icon.remove();

    // If the deletion emptied a line, ensure a ZWSP spacer exists so the line
    // is visible and the caret can sit on it. Place the caret at the start of
    // this empty line instead of collapsing into the previous line.
    if (brBefore && iconIsSoleOnLine) {
      let spacer = brBefore.nextSibling;
      const needsSpacer = !(
        spacer instanceof HTMLElement &&
        spacer.dataset.editorLineSpacer === "true"
      );
      if (needsSpacer) {
        const newSpacer = document.createElement("span");
        newSpacer.dataset.editorLineSpacer = "true";
        newSpacer.textContent = "\u200B";
        brBefore.parentNode?.insertBefore(newSpacer, brBefore.nextSibling);
        spacer = newSpacer;
      }
      const spacerText = (spacer as HTMLElement).firstChild as Node;
      const caret = document.createRange();
      caret.setStart(spacerText, spacerText.textContent?.length ?? 1);
      caret.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(caret);
      savedRangeRef.current = caret.cloneRange();
      setSelectedIcons([]);
      setSelectedIconCount(0);
      setSelectedSingleIcon(null);
      setSelectedIconHasShading(false);
      resetTypingHistorySession();
      commitHistory("push");
      return true;
    }

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    savedRangeRef.current = range.cloneRange();
    setSelectedIcons([]);
    setSelectedIconCount(0);
    setSelectedSingleIcon(null);
    setSelectedIconHasShading(false);
    resetTypingHistorySession();
    commitHistory("push");
    return true;
  };

  const getManualLineBreakBeforeCaret = (range: Range) => {
    if (!range.collapsed) return null;

    const resolveLineBreakPair = (spacer: HTMLElement | null) => {
      if (!spacer || spacer.dataset.editorLineSpacer !== "true") return null;
      const br = spacer.previousSibling;
      if (!(br instanceof HTMLBRElement)) return null;
      if (br.dataset.editorLineBreak !== "true") return null;
      return { br, spacer };
    };

    /** Only strip an empty line (spacer is ZWSP-only). SVG glyphs often contribute
     *  nothing to textContent, so icons nested in the spacer must not count as empty. */
    const emptyLinePairOnly = (
      pair: { br: HTMLBRElement; spacer: HTMLElement } | null,
    ) => {
      if (!pair) return null;
      if (pair.spacer.querySelector(".svg-icon, img")) return null;
      const hasRealText =
        (pair.spacer.textContent || "").replace(/\u200B/g, "").length > 0;
      return hasRealText ? null : pair;
    };

    const { startContainer, startOffset } = range;

    if (startContainer.nodeType === Node.TEXT_NODE) {
      const parent = startContainer.parentElement;
      if (parent?.dataset.editorLineSpacer === "true") {
        return emptyLinePairOnly(resolveLineBreakPair(parent));
      }
    }

    if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
      const previousNode = startContainer.childNodes[startOffset - 1] as
        | ChildNode
        | undefined;

      if (
        previousNode instanceof HTMLBRElement &&
        previousNode.dataset.editorLineBreak === "true"
      ) {
        return { br: previousNode, spacer: null };
      }

      if (previousNode instanceof HTMLElement) {
        return emptyLinePairOnly(resolveLineBreakPair(previousNode));
      }
    }

    return null;
  };

  const removeManualLineBreakBeforeCaret = (range: Range) => {
    const pair = getManualLineBreakBeforeCaret(range);
    if (!pair) return false;

    const parent = pair.br.parentNode;
    if (!parent) return false;

    const insertionIndex = Array.prototype.indexOf.call(
      parent.childNodes,
      pair.br,
    );
    if (pair.spacer) pair.spacer.remove();
    pair.br.remove();

    const sel = window.getSelection();
    const newRange = document.createRange();
    newRange.setStart(
      parent,
      Math.min(insertionIndex, parent.childNodes.length),
    );
    newRange.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(newRange);
    savedRangeRef.current = newRange.cloneRange();
    resetTypingHistorySession();
    commitHistory("push");
    return true;
  };

  const getManualLineBreakAfterCaret = (range: Range) => {
    if (!range.collapsed) return null;

    const resolveFromBreak = (br: Node | null) => {
      if (!(br instanceof HTMLBRElement)) return null;
      if (br.dataset.editorLineBreak !== "true") return null;
      const spacer = br.nextSibling;
      if (!(spacer instanceof HTMLElement)) return null;
      if (spacer.dataset.editorLineSpacer !== "true") return null;
      return { br, spacer };
    };

    const { startContainer, startOffset } = range;

    if (startContainer.nodeType === Node.TEXT_NODE) {
      const text = startContainer.textContent || "";
      if (startOffset < text.length) return null;

      const nextSibling = startContainer.parentNode?.nextSibling ?? null;
      return resolveFromBreak(nextSibling);
    }

    if (startContainer.nodeType === Node.ELEMENT_NODE) {
      const nextNode = startContainer.childNodes[startOffset] as
        | ChildNode
        | undefined;
      return resolveFromBreak(nextNode ?? null);
    }

    return null;
  };

  const removeManualLineBreakAfterCaret = (range: Range) => {
    const pair = getManualLineBreakAfterCaret(range);
    if (!pair) return false;

    const parent = pair.br.parentNode;
    if (!parent) return false;

    const insertionIndex = Array.prototype.indexOf.call(
      parent.childNodes,
      pair.br,
    );
    pair.spacer.remove();
    pair.br.remove();

    const sel = window.getSelection();
    const newRange = document.createRange();
    newRange.setStart(
      parent,
      Math.min(insertionIndex, parent.childNodes.length),
    );
    newRange.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(newRange);
    savedRangeRef.current = newRange.cloneRange();
    resetTypingHistorySession();
    commitHistory("push");
    return true;
  };

  const clearEmptyTypingSpanAtSelection = () => {
    const sel = window.getSelection();
    const anchor = sel?.anchorNode;
    const typingSpan =
      anchor && anchor.nodeType === Node.ELEMENT_NODE
        ? (anchor as Element).closest('span[data-typing-size="true"]')
        : anchor?.parentElement?.closest('span[data-typing-size="true"]');

    if (typingSpan && typingSpan.textContent === "\u200B") {
      typingSpan.remove();
    }
  };

  const insertLineBreakAtRange = (editor: HTMLElement, range: Range) => {
    const sel = window.getSelection();
    if (!sel) return;

    range.deleteContents();

    const anchorNode = range.startContainer;
    const anchorEl =
      anchorNode.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : (anchorNode as HTMLElement);

    // Escape wrappers that would trap the new line inside hidden or special
    // containers.
    const enclosingSpacer = anchorEl?.closest?.(
      '[data-editor-line-spacer="true"]',
    ) as HTMLElement | null;
    if (enclosingSpacer && editor.contains(enclosingSpacer)) {
      range.setStartAfter(enclosingSpacer);
      range.collapse(true);
    }
    const enclosingBoundary = anchorEl?.closest?.(
      '[data-selection-boundary="true"]',
    ) as HTMLElement | null;
    if (enclosingBoundary && editor.contains(enclosingBoundary)) {
      range.setStartAfter(enclosingBoundary);
      range.collapse(true);
    }

    // Insert exactly one <br> at the caret. No execCommand, no placeholder <br>,
    // no extras — this gives Word-like behavior: a single clean line break
    // with the caret at the start of the new line.
    const br = document.createElement("br");
    br.dataset.editorLineBreak = "true";
    range.insertNode(br);

    // Decide whether we need a ZWSP spacer as a caret anchor on the new line:
    // - New line starts with a non-editable element (icon/img): spacer lets
    //   the caret sit before the icon.
    // - New line is empty (nothing meaningful follows the <br>): a bare
    //   trailing <br> is not rendered as a visible empty line, so we insert
    //   a spacer to make it visible AND anchor the caret.
    //
    // Note: range.insertNode on a text-node caret splits the text node, which
    // can leave an empty text node after the <br>. We must treat empty /
    // whitespace-only text nodes as "no content" so the spacer still gets
    // added in that common case.
    const isEmptyTextNode = (n: Node | null) =>
      !!n &&
      n.nodeType === Node.TEXT_NODE &&
      (n.textContent || "").replace(/\u200B/g, "").length === 0;
    const isEditorLineBreak = (n: Node | null) =>
      n instanceof HTMLElement &&
      n.tagName === "BR" &&
      n.getAttribute("data-editor-line-break") === "true";

    let firstMeaningfulAfterBr: Node | null = br.nextSibling;
    while (firstMeaningfulAfterBr && isEmptyTextNode(firstMeaningfulAfterBr)) {
      firstMeaningfulAfterBr = firstMeaningfulAfterBr.nextSibling;
    }
    const nextIsNonEditable =
      firstMeaningfulAfterBr instanceof HTMLElement &&
      (firstMeaningfulAfterBr.classList.contains("svg-icon") ||
        firstMeaningfulAfterBr.tagName === "IMG");
    const newLineIsEmpty =
      !firstMeaningfulAfterBr || isEditorLineBreak(firstMeaningfulAfterBr);

    let spacer: HTMLElement | null = null;
    if (nextIsNonEditable || newLineIsEmpty) {
      spacer = document.createElement("span");
      spacer.dataset.editorLineSpacer = "true";
      spacer.textContent = "\u200B";
      br.parentNode?.insertBefore(spacer, br.nextSibling);
    }

    const newRange = document.createRange();
    if (spacer) {
      // Place the caret at the END of the spacer's ZWSP so that arrow-right
      // moves directly to the first icon in one press.
      const spacerText = spacer.firstChild as Node;
      newRange.setStart(spacerText, spacerText.textContent?.length ?? 1);
    } else {
      newRange.setStartAfter(br);
    }
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    savedRangeRef.current = newRange.cloneRange();

    editor.focus();
    resetTypingHistorySession();
    commitHistory("push");
  };

  const handleEditorBeforeInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (!editorCanEdit) {
      e.preventDefault();
      return;
    }

    const editor = editorRef.current;
    if (!editor || isApplyingHistoryRef.current) return;

    const nativeEvent = e.nativeEvent as InputEvent;
    const inputType = nativeEvent.inputType || "";
    if (!inputType) return;

    const selectionInfo = getSelectionInEditor(editor);
    if (!selectionInfo) return;
    const { range } = selectionInfo;
    const li = getClosestListItem(range.startContainer);

    if (inputType === "deleteContentBackward") {
      if (removeManualLineBreakBeforeCaret(range)) {
        e.preventDefault();
        return;
      }

      if (removeAdjacentSvgIcon(editor, range, "backward")) {
        e.preventDefault();
      }
      return;
    }

    if (inputType === "deleteContentForward") {
      if (removeManualLineBreakAfterCaret(range)) {
        e.preventDefault();
        return;
      }

      if (removeAdjacentSvgIcon(editor, range, "forward")) {
        e.preventDefault();
      }
      return;
    }

    if (inputType === "insertParagraph" || inputType === "insertLineBreak") {
      // Actual edits run in keydown (see handleEditorKeyDown). Here we only cancel
      // the native paragraph/line insertion so we do not get <div><br></div> *and*
      // our manual <br> when both handlers run.
      if ((li && isListItemEmpty(li)) || !li) {
        e.preventDefault();
      }
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!editorCanEdit) {
      e.preventDefault();
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          performRedo();
        } else {
          performUndo();
        }
        return;
      }

      if (key === "y") {
        e.preventDefault();
        performRedo();
        return;
      }

      if (key === "a") {
        // Native Ctrl+A in this editor occasionally fails to highlight the
        // very first child — most often the first glyph — because the
        // leading `data-selection-boundary` ZWSP span anchors the range's
        // start *inside* its text node, and the browser's atom-highlight
        // pass starts after that anchor. Take over and set the range
        // explicitly to span editor:0 → editor:childNodes.length so every
        // top-level child (including the first glyph) is in the range.
        e.preventDefault();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(editor);
          sel.removeAllRanges();
          sel.addRange(range);
          savedRangeRef.current = range.cloneRange();
        }
        return;
      }
    }

    const selectionInfo = getSelectionInEditor(editor);
    if (!selectionInfo) return;
    const { range } = selectionInfo;
    const li = getClosestListItem(range.startContainer);

    if (e.key === "Backspace" && removeManualLineBreakBeforeCaret(range)) {
      e.preventDefault();
      return;
    }

    if (
      e.key === "Backspace" &&
      removeAdjacentSvgIcon(editor, range, "backward")
    ) {
      e.preventDefault();
      return;
    }

    // If the caret is at the very start of the editor's real content
    // (only ignorable boundary/spacer/empty-text nodes precede it),
    // swallow Backspace. The browser's native Backspace at this position
    // otherwise tries to delete the next atomic inline-block — i.e. the
    // first glyph — and a held-down Backspace then peels the entire
    // line away one glyph at a time. Symmetric guard for Delete at the
    // end of all real content.
    if (e.key === "Backspace" && !hasMeaningfulContentOnSide(editor, range, "backward")) {
      e.preventDefault();
      return;
    }

    if (e.key === "Delete" && removeAdjacentSvgIcon(editor, range, "forward")) {
      e.preventDefault();
      return;
    }

    if (e.key === "Delete" && !hasMeaningfulContentOnSide(editor, range, "forward")) {
      e.preventDefault();
      return;
    }

    if (e.key == "Tab") {
      e.preventDefault();
      document.execCommand(e.shiftKey ? "outdent" : "indent");
      return;
    }

    // Skip over zero-width-space caret anchors in one arrow press. Without
    // this, ArrowLeft/Right would need two presses to cross a line-spacer
    // (one to traverse the invisible ZWSP, another to actually move).
    if (
      (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
      !e.shiftKey &&
      range.collapsed
    ) {
      const startNode = range.startContainer;
      if (
        startNode.nodeType === Node.TEXT_NODE &&
        startNode.parentElement?.getAttribute("data-editor-line-spacer") ===
          "true"
      ) {
        const spacer = startNode.parentElement as HTMLElement;
        const textLen = startNode.textContent?.length ?? 0;

        if (e.key === "ArrowLeft" && range.startOffset === textLen) {
          const prev = spacer.previousSibling;
          if (
            prev instanceof HTMLElement &&
            prev.tagName === "BR" &&
            prev.getAttribute("data-editor-line-break") === "true"
          ) {
            e.preventDefault();
            const newRange = document.createRange();
            newRange.setStartBefore(prev);
            newRange.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(newRange);
            savedRangeRef.current = newRange.cloneRange();
            return;
          }
        }

        if (e.key === "ArrowRight" && range.startOffset === 0) {
          e.preventDefault();
          const newRange = document.createRange();
          newRange.setStartAfter(spacer);
          newRange.collapse(true);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(newRange);
          savedRangeRef.current = newRange.cloneRange();
          return;
        }
      }
    }

    // Do not return early for Enter: the handlers below must run so the line break
    // is applied in keydown. (An early return used to defer Enter to beforeinput only,
    // but keydown preventDefault blocked beforeinput and broke Enter entirely.)

    if (
      typeof InputEvent !== "undefined" &&
      (e.key === "Backspace" || e.key === "Delete")
    ) {
      return;
    }

    if (e.key === "Backspace" && removeManualLineBreakBeforeCaret(range)) {
      e.preventDefault();
      return;
    }

    if (
      e.key === "Backspace" &&
      removeAdjacentSvgIcon(editor, range, "backward")
    ) {
      e.preventDefault();
      return;
    }

    if (e.key === "Delete" && removeManualLineBreakAfterCaret(range)) {
      e.preventDefault();
      return;
    }

    if (e.key === "Delete" && removeAdjacentSvgIcon(editor, range, "forward")) {
      e.preventDefault();
      return;
    }

    // Pressing Enter while the selection sits inside a `.vertical-run`
    // would otherwise either (a) insert a line break in vertical writing
    // mode — renders upright and overlaps the hieroglyphs in the run, or
    // (b) for a NON-collapsed selection, fall through to the generic
    // Enter branch and `range.deleteContents()` would wipe every glyph
    // in the run (the typical case right after toggling vertical mode,
    // because we deliberately preserve the selection across the wrapper's
    // contents so the user can revert). In both cases we want the same
    // outcome: jump out of the vertical-run, drop a clean line break,
    // and let the user type horizontally on the new line.
    if (e.key === "Enter") {
      const enclosingStart = findEnclosingVerticalRun(
        range.startContainer,
        editor,
      );
      const enclosingEnd = findEnclosingVerticalRun(
        range.endContainer,
        editor,
      );
      const enclosing = enclosingStart || enclosingEnd;
      if (enclosing) {
        e.preventDefault();
        placeCaretAfter(enclosing);
        const refreshed = getSelectionInEditor(editor);
        if (refreshed) {
          clearEmptyTypingSpanAtSelection();
          insertLineBreakAtRange(editor, refreshed.range);
        }
        return;
      }
    }

    if (e.key === "Enter" && li && isListItemEmpty(li)) {
      e.preventDefault();
      document.execCommand("outdent");

      const after = getSelectionInEditor(editor);
      if (after) {
        const stillLi = getClosestListItem(after.range.startContainer);
        if (stillLi) {
          document.execCommand("insertParagraph");
          document.execCommand("outdent");
        }
      }
      resetTypingHistorySession();
      commitHistory("push");
      return;
    }

    if (e.key === "Enter" && !li) {
      e.preventDefault();
      clearEmptyTypingSpanAtSelection();
      insertLineBreakAtRange(editor, range);
    }
  };

  const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (isApplyingHistoryRef.current) return;

    const typingSpans = Array.from(
      editor.querySelectorAll('span[data-typing-size="true"]'),
    ) as HTMLElement[];

    typingSpans.forEach((span) => {
      const text = (span.textContent || "").replace(/\u200B/g, "");
      if (text.length === 0) {
        span.remove();
        return;
      }

      span.removeAttribute("data-typing-size");
      span.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
          node.textContent = node.textContent.replace(/\u200B/g, "");
        }
      });
    });

    normalizeEditorArtifacts(editor);
    normalizeTextSizeSpans(editor);

    const nativeEvent = e.nativeEvent as InputEvent;
    const inputType = nativeEvent.inputType || "";
    const insertedText = nativeEvent.data ?? "";
    const isTypingInput =
      inputType.startsWith("insertText") ||
      inputType.startsWith("deleteContentBackward") ||
      inputType.startsWith("deleteContentForward") ||
      inputType.startsWith("insertCompositionText") ||
      inputType.startsWith("deleteByComposition");
    const shouldStartNewTypingStep =
      inputType === "insertParagraph" ||
      /\s/.test(insertedText) ||
      /[.,!?;:()[\]{}"'-]/.test(insertedText);

    if (isTypingInput) {
      if (!typingHistoryActiveRef.current || shouldStartNewTypingStep) {
        commitHistory("push");
        typingHistoryActiveRef.current = !shouldStartNewTypingStep;
      } else {
        commitHistory("replace");
      }
      scheduleTypingHistoryReset();
      return;
    }

    if (inputType === "insertParagraph") {
      resetTypingHistorySession();
      commitHistory("push");
      return;
    }

    resetTypingHistorySession();
    commitHistory("push");
  };

  // ... svg transform logic ... move it i understand it
  const getSvgTransform = () => {
    if (direction === "rtl") {
      return "scaleX(-1)";
    }
    return "none";
  };

  // Normalize an arbitrary angle into [0, 360). Negative or > 360 inputs
  // (from typed numbers, dial drags that go past the seam, etc.) all land
  // back inside the canonical range so the data-rotation attribute stays
  // tidy across history snapshots and copy/paste round-trips.
  const normalizeAngle = (deg: number): number => {
    if (!Number.isFinite(deg)) return 0;
    const wrapped = ((deg % 360) + 360) % 360;
    return Math.round(wrapped * 1000) / 1000;
  };

  // Compose the inline `transform` for a single icon wrapper from its
  // independent visual states: RTL document flip, user rotation, and the
  // legacy per-icon scale (set by some legacy paths). Order matters — we
  // apply the rotation BEFORE the RTL flip in CSS-source order (which
  // means the flip applies after rotation in screen-space) so the user's
  // rotation always reads as "rotate the visible glyph by N°", same as
  // every other editor that ships a rotate handle.
  const composeIconTransform = (el: HTMLElement): string => {
    const rotation = normalizeAngle(Number(el.dataset.rotation || "0"));
    const flipped = direction === "rtl";
    const isMerged = el.classList.contains("merged");
    const scale = isMerged
      ? 1
      : Number(el.dataset.scale || "1") || 1;

    const parts: string[] = [];
    if (flipped) parts.push("scaleX(-1)");
    if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);
    if (scale !== 1) parts.push(`scale(${scale})`);

    return parts.length === 0 ? "none" : parts.join(" ");
  };

  // Set an icon's rotation (in degrees) and re-derive its inline transform.
  // No-ops on nested glyphs (inside merged groups or cartouches) — those
  // are visual children of an outer wrapper and rotate with their parent.
  const applyRotationToIcon = (el: HTMLElement, angle: number) => {
    if (!el.classList.contains("svg-icon")) return;
    if (el.parentElement?.closest(".svg-icon")) return;
    const normalized = normalizeAngle(angle);
    if (normalized === 0) {
      delete el.dataset.rotation;
    } else {
      el.dataset.rotation = String(normalized);
    }
    el.style.transform = composeIconTransform(el);
    // Setting transform to a non-identity value can clip antialiased
    // edges of children rendered with subpixel accumulators in some
    // browsers; nudging transform-origin to centre keeps the rotation
    // about the icon's middle (the natural expectation).
    el.style.transformOrigin = normalized === 0 ? "" : "center center";
  };

  /** Compute icon SVG width/height from pictureSize, baseSize, aspect ratio, and layout mode.
   * Horizontal: build on height (fixed), give max width.
   * Column: build on width (fixed), give max height (reverse). */
  const getIconLayoutDimensions = (
    ps: number,
    baseSize: number,
    arW: number,
    arH: number,
    isColumnMode: boolean,
  ): { width: number; height: number } => {
    if (isColumnMode) {
      // Column mode: build calculation on width (like horizontal builds on height), max height = baseSize
      let calcW = Math.max(Math.round(baseSize * (arW / arH)), 4);
      if (ps !== 100 && calcW > baseSize) {
        calcW = Math.max(Math.round((ps / 100) * baseSize), 4);
      } else if (calcW > baseSize) {
        calcW = baseSize;
      }
      let calcH = Math.max(Math.round(calcW * (arH / arW)), 4);
      if (calcH > baseSize) calcH = baseSize;
      return { width: calcW, height: calcH };
    }
    // Horizontal: build on height, max width
    let calcW = Math.max(Math.round(baseSize * (arW / arH)), 4);
    if (ps !== 100 && calcW > baseSize) {
      calcW = Math.max(Math.round((ps / 100) * baseSize), 4);
    } else if (calcW > baseSize) {
      calcW = baseSize;
    }
    return { width: calcW, height: baseSize };
  };

  /** Apply width/height to an icon's inner SVG based on pictureSize and columnMode. */
  const applyIconDimensionsToElement = (iconEl: HTMLElement) => {
    if (
      iconEl.dataset.cartouche === "true" ||
      iconEl.classList.contains("merged")
    )
      return;
    const svg = iconEl.querySelector(":scope > svg") as SVGSVGElement | null;
    if (!svg) return;
    const ps = Number(iconEl.dataset.pictureSize || "100") || 100;
    const baseSize = Number(iconEl.dataset.baseSize) || iconSize;
    let arW = Number(iconEl.dataset.arW);
    let arH = Number(iconEl.dataset.arH);

    // In column mode: use tight viewBox from getBBox() to remove internal top/bottom whitespace
    if (columnMode && typeof svg.getBBox === "function") {
      try {
        const bbox = svg.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          svg.setAttribute(
            "viewBox",
            `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`,
          );
          arW = bbox.width;
          arH = bbox.height;
          iconEl.dataset.arW = String(arW);
          iconEl.dataset.arH = String(arH);
        }
      } catch {
        // getBBox failed (e.g. not rendered), fall back to existing arW/arH
      }
    }

    if (
      !Number.isFinite(arW) ||
      !Number.isFinite(arH) ||
      arW <= 0 ||
      arH <= 0
    ) {
      const vb = svg.getAttribute("viewBox");
      if (vb) {
        const p = vb.trim().split(/[\s,]+/);
        arW = parseFloat(p[2]) || 100;
        arH = parseFloat(p[3]) || 100;
      } else {
        arW = 100;
        arH = 100;
      }
    }
    const { width, height } = getIconLayoutDimensions(
      ps,
      baseSize,
      arW,
      arH,
      columnMode,
    );
    (svg.style as CSSStyleDeclaration).width = `${width}px`;
    (svg.style as CSSStyleDeclaration).height = `${height}px`;
    // In column mode: set wrapper height to calculated height so no extra space above/below
    if (columnMode) {
      iconEl.style.height = `${height}px`;
      iconEl.style.lineHeight = `${height}px`;
    } else {
      iconEl.style.height = "";
      iconEl.style.lineHeight = "";
    }
  };

  // Read the cartouche shape persisted on a wrapper. Falls back to "oval"
  // for any wrapper created before the shape feature shipped (those have
  // no `data-cartouche-shape` attribute), so legacy documents continue to
  // re-render as the original Egyptian cartouche on resize / vertical-flip.
  const getCartoucheShape = (el: HTMLElement): CartoucheShape => {
    const raw = el.dataset.cartoucheShape;
    if (raw === "oval") return raw;
    return "oval";
  };

  const buildCartoucheSvg = (
    W: number,
    H: number,
    vertical = false,
    shape: CartoucheShape = "oval",
  ): SVGSVGElement => {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", `${W}`);
    svg.setAttribute("height", `${H}`);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;";

    const strokeStyle = "fill:none;stroke:#000000;stroke-width:1";
    const barStyle = "fill:none;stroke:#000000;stroke-width:1.5";

    // The "oval" shape draws the classic Egyptian cartouche: two flat
    // sides with semi-circular end caps and a single perpendicular bar
    // at the terminating end. The "rectangle" and "rounded" shapes share
    // the same end-bar but use a (rounded) rectangle for the frame, so
    // we route them through a shared path below.
    if (shape === "oval") {
      if (vertical) {
        const pad = W * 0.0208;
        const curveAnchor = W * 0.4167;
        const ctrlExtend = W * 0.1181;

        const topAnchorY = Math.min(curveAnchor, H / 2);
        const bottomAnchorY = Math.max(H - curveAnchor, H / 2);
        const xLeft = pad;
        const xRight = W - pad;

        const topCurve = document.createElementNS(svgNS, "path");
        topCurve.setAttribute(
          "d",
          `M ${xLeft} ${topAnchorY} C ${xLeft} ${-ctrlExtend} ${xRight} ${-ctrlExtend} ${xRight} ${topAnchorY}`,
        );
        topCurve.setAttribute("style", strokeStyle);
        svg.appendChild(topCurve);

        const bottomCurve = document.createElementNS(svgNS, "path");
        bottomCurve.setAttribute(
          "d",
          `M ${xLeft} ${bottomAnchorY} C ${xLeft} ${H + ctrlExtend} ${xRight} ${H + ctrlExtend} ${xRight} ${bottomAnchorY}`,
        );
        bottomCurve.setAttribute("style", strokeStyle);
        svg.appendChild(bottomCurve);

        if (bottomAnchorY > topAnchorY + 0.5) {
          const leftLine = document.createElementNS(svgNS, "path");
          leftLine.setAttribute(
            "d",
            `M ${xLeft} ${topAnchorY} L ${xLeft} ${bottomAnchorY}`,
          );
          leftLine.setAttribute("style", strokeStyle);
          svg.appendChild(leftLine);

          const rightLine = document.createElementNS(svgNS, "path");
          rightLine.setAttribute(
            "d",
            `M ${xRight} ${topAnchorY} L ${xRight} ${bottomAnchorY}`,
          );
          rightLine.setAttribute("style", strokeStyle);
          svg.appendChild(rightLine);
        }

        const barY = H - Math.max(1, W * 0.03);
        const endBar = document.createElementNS(svgNS, "path");
        endBar.setAttribute("d", `M ${xLeft} ${barY} L ${xRight} ${barY}`);
        endBar.setAttribute("style", barStyle);
        svg.appendChild(endBar);
      } else {
        const pad = H * 0.0208;
        const curveAnchor = H * 0.4167;
        const ctrlExtend = H * 0.1181;

        const leftAnchorX = Math.min(curveAnchor, W / 2);
        const rightAnchorX = Math.max(W - curveAnchor, W / 2);
        const yTop = pad;
        const yBot = H - pad;

        const leftCurve = document.createElementNS(svgNS, "path");
        leftCurve.setAttribute(
          "d",
          `M ${leftAnchorX} ${yTop} C ${-ctrlExtend} ${yTop} ${-ctrlExtend} ${yBot} ${leftAnchorX} ${yBot}`,
        );
        leftCurve.setAttribute("style", strokeStyle);
        svg.appendChild(leftCurve);

        const rightCurve = document.createElementNS(svgNS, "path");
        rightCurve.setAttribute(
          "d",
          `M ${rightAnchorX} ${yTop} C ${W + ctrlExtend} ${yTop} ${W + ctrlExtend} ${yBot} ${rightAnchorX} ${yBot}`,
        );
        rightCurve.setAttribute("style", strokeStyle);
        svg.appendChild(rightCurve);

        if (rightAnchorX > leftAnchorX + 0.5) {
          const topLine = document.createElementNS(svgNS, "path");
          topLine.setAttribute(
            "d",
            `M ${leftAnchorX} ${yTop} L ${rightAnchorX} ${yTop}`,
          );
          topLine.setAttribute("style", strokeStyle);
          svg.appendChild(topLine);

          const bottomLine = document.createElementNS(svgNS, "path");
          bottomLine.setAttribute(
            "d",
            `M ${leftAnchorX} ${yBot} L ${rightAnchorX} ${yBot}`,
          );
          bottomLine.setAttribute("style", strokeStyle);
          svg.appendChild(bottomLine);
        }

        const barX = W - Math.max(1, H * 0.03);
        const endBar = document.createElementNS(svgNS, "path");
        endBar.setAttribute("d", `M ${barX} ${yTop} L ${barX} ${yBot}`);
        endBar.setAttribute("style", barStyle);
        svg.appendChild(endBar);
      }
    } else if (shape === "hwt") {
      // Hwt — port of jsesh's HwtDrawer. Flat-sided rectangular frame
      // with a small "knot" square inset at each cap corner, marking
      // the enclosure as a sacred / temple boundary. Geometry is
      // symmetric in both orientations: caps at the start and end,
      // body fills the middle.
      const refPerp = vertical ? W : H;
      const refLong = vertical ? H : W;
      const capLen = Math.max(2, refPerp * 0.12);
      // Inset square dimension (jsesh's `getHwtSquareSize`). Drawn at
      // the inside corners of each cap.
      const knot = Math.max(1.5, refPerp * 0.18);

      if (vertical) {
        const xLeft = 0.5;
        const xRight = W - 0.5;
        const yTop = 0.5;
        const yBot = H - 0.5;
        const yStartCap = capLen;
        const yEndCap = H - capLen;

        // Body: two long verticals running the inner length.
        const left = document.createElementNS(svgNS, "path");
        left.setAttribute(
          "d",
          `M ${xLeft} ${yStartCap} L ${xLeft} ${yEndCap}`,
        );
        left.setAttribute("style", strokeStyle);
        svg.appendChild(left);
        const right = document.createElementNS(svgNS, "path");
        right.setAttribute(
          "d",
          `M ${xRight} ${yStartCap} L ${xRight} ${yEndCap}`,
        );
        right.setAttribute("style", strokeStyle);
        svg.appendChild(right);

        // Start cap (top). Flat top + two side joins + a knot square
        // tucked into the bottom-left inner corner of the cap.
        const top = document.createElementNS(svgNS, "path");
        top.setAttribute("d", `M ${xLeft} ${yTop} L ${xRight} ${yTop}`);
        top.setAttribute("style", strokeStyle);
        svg.appendChild(top);
        const topL = document.createElementNS(svgNS, "path");
        topL.setAttribute(
          "d",
          `M ${xLeft} ${yTop} L ${xLeft} ${yStartCap}`,
        );
        topL.setAttribute("style", strokeStyle);
        svg.appendChild(topL);
        const topR = document.createElementNS(svgNS, "path");
        topR.setAttribute(
          "d",
          `M ${xRight} ${yTop} L ${xRight} ${yStartCap}`,
        );
        topR.setAttribute("style", strokeStyle);
        svg.appendChild(topR);
        const knotTop = document.createElementNS(svgNS, "path");
        knotTop.setAttribute(
          "d",
          `M ${xLeft} ${yStartCap - knot} L ${xLeft + knot} ${yStartCap - knot} L ${xLeft + knot} ${yStartCap}`,
        );
        knotTop.setAttribute("style", strokeStyle);
        svg.appendChild(knotTop);

        // End cap (bottom).
        const bot = document.createElementNS(svgNS, "path");
        bot.setAttribute("d", `M ${xLeft} ${yBot} L ${xRight} ${yBot}`);
        bot.setAttribute("style", strokeStyle);
        svg.appendChild(bot);
        const botL = document.createElementNS(svgNS, "path");
        botL.setAttribute("d", `M ${xLeft} ${yEndCap} L ${xLeft} ${yBot}`);
        botL.setAttribute("style", strokeStyle);
        svg.appendChild(botL);
        const botR = document.createElementNS(svgNS, "path");
        botR.setAttribute(
          "d",
          `M ${xRight} ${yEndCap} L ${xRight} ${yBot}`,
        );
        botR.setAttribute("style", strokeStyle);
        svg.appendChild(botR);
        const knotBot = document.createElementNS(svgNS, "path");
        knotBot.setAttribute(
          "d",
          `M ${xLeft + knot} ${yEndCap} L ${xLeft + knot} ${yEndCap + knot} L ${xLeft} ${yEndCap + knot}`,
        );
        knotBot.setAttribute("style", strokeStyle);
        svg.appendChild(knotBot);
      } else {
        const yTop = 0.5;
        const yBot = H - 0.5;
        const xLeft = 0.5;
        const xRight = W - 0.5;
        const xStartCap = capLen;
        const xEndCap = W - capLen;

        // Body: two long horizontals running the inner length.
        const top = document.createElementNS(svgNS, "path");
        top.setAttribute(
          "d",
          `M ${xStartCap} ${yTop} L ${xEndCap} ${yTop}`,
        );
        top.setAttribute("style", strokeStyle);
        svg.appendChild(top);
        const bot = document.createElementNS(svgNS, "path");
        bot.setAttribute(
          "d",
          `M ${xStartCap} ${yBot} L ${xEndCap} ${yBot}`,
        );
        bot.setAttribute("style", strokeStyle);
        svg.appendChild(bot);

        // Start cap (left). Flat left side + two top/bottom joins + a
        // knot square at the bottom-inner corner of the cap.
        const leftCap = document.createElementNS(svgNS, "path");
        leftCap.setAttribute("d", `M ${xLeft} ${yTop} L ${xLeft} ${yBot}`);
        leftCap.setAttribute("style", strokeStyle);
        svg.appendChild(leftCap);
        const leftTop = document.createElementNS(svgNS, "path");
        leftTop.setAttribute(
          "d",
          `M ${xLeft} ${yTop} L ${xStartCap} ${yTop}`,
        );
        leftTop.setAttribute("style", strokeStyle);
        svg.appendChild(leftTop);
        const leftBot = document.createElementNS(svgNS, "path");
        leftBot.setAttribute(
          "d",
          `M ${xLeft} ${yBot} L ${xStartCap} ${yBot}`,
        );
        leftBot.setAttribute("style", strokeStyle);
        svg.appendChild(leftBot);
        const knotLeft = document.createElementNS(svgNS, "path");
        knotLeft.setAttribute(
          "d",
          `M ${xStartCap - knot} ${yBot} L ${xStartCap - knot} ${yBot - knot} L ${xStartCap} ${yBot - knot}`,
        );
        knotLeft.setAttribute("style", strokeStyle);
        svg.appendChild(knotLeft);

        // End cap (right).
        const rightCap = document.createElementNS(svgNS, "path");
        rightCap.setAttribute(
          "d",
          `M ${xRight} ${yTop} L ${xRight} ${yBot}`,
        );
        rightCap.setAttribute("style", strokeStyle);
        svg.appendChild(rightCap);
        const rightTop = document.createElementNS(svgNS, "path");
        rightTop.setAttribute(
          "d",
          `M ${xEndCap} ${yTop} L ${xRight} ${yTop}`,
        );
        rightTop.setAttribute("style", strokeStyle);
        svg.appendChild(rightTop);
        const rightBot = document.createElementNS(svgNS, "path");
        rightBot.setAttribute(
          "d",
          `M ${xEndCap} ${yBot} L ${xRight} ${yBot}`,
        );
        rightBot.setAttribute("style", strokeStyle);
        svg.appendChild(rightBot);
        const knotRight = document.createElementNS(svgNS, "path");
        knotRight.setAttribute(
          "d",
          `M ${xEndCap} ${yBot - knot} L ${xEndCap + knot} ${yBot - knot} L ${xEndCap + knot} ${yBot}`,
        );
        knotRight.setAttribute("style", strokeStyle);
        svg.appendChild(knotRight);
      }
      // Mark refLong as used (the cap length is derived from refPerp; we
      // keep refLong for symmetry with the other shapes' geometry blocks).
      void refLong;
    } else if (shape === "serekh") {
      // Serekh — port of jsesh's SerekhDrawer. The "name" end of the
      // frame is a Hwt-style flat cap; the OPPOSITE end is a stylized
      // palace facade with cornice lines and rectangular recesses.
      // The palace side is always at the START of the frame in our
      // local coordinate space — RTL flipping is handled by the
      // wrapper's outer scaleX(-1) transform, so we don't mirror here.
      const refPerp = vertical ? W : H;
      const fineStyle = "fill:none;stroke:#000000;stroke-width:0.6";
      const facadeLen = Math.max(8, refPerp * 0.55);
      const hwtCapLen = Math.max(2, refPerp * 0.12);
      const hwtKnot = Math.max(1.5, refPerp * 0.18);

      if (vertical) {
        const xLeft = 0.5;
        const xRight = W - 0.5;
        const yTop = 0.5;
        const yBot = H - 0.5;
        const yFacadeEnd = facadeLen;
        const yHwtStart = H - hwtCapLen;

        // Body sides (between the palace facade end and the Hwt cap).
        const left = document.createElementNS(svgNS, "path");
        left.setAttribute(
          "d",
          `M ${xLeft} ${yFacadeEnd} L ${xLeft} ${yHwtStart}`,
        );
        left.setAttribute("style", strokeStyle);
        svg.appendChild(left);
        const right = document.createElementNS(svgNS, "path");
        right.setAttribute(
          "d",
          `M ${xRight} ${yFacadeEnd} L ${xRight} ${yHwtStart}`,
        );
        right.setAttribute("style", strokeStyle);
        svg.appendChild(right);

        // --- Palace facade (start cap, top) ---
        // Outer top + side joins.
        const facadeTop = document.createElementNS(svgNS, "path");
        facadeTop.setAttribute(
          "d",
          `M ${xLeft} ${yTop} L ${xRight} ${yTop}`,
        );
        facadeTop.setAttribute("style", strokeStyle);
        svg.appendChild(facadeTop);
        const facadeL = document.createElementNS(svgNS, "path");
        facadeL.setAttribute(
          "d",
          `M ${xLeft} ${yTop} L ${xLeft} ${yFacadeEnd}`,
        );
        facadeL.setAttribute("style", strokeStyle);
        svg.appendChild(facadeL);
        const facadeR = document.createElementNS(svgNS, "path");
        facadeR.setAttribute(
          "d",
          `M ${xRight} ${yTop} L ${xRight} ${yFacadeEnd}`,
        );
        facadeR.setAttribute("style", strokeStyle);
        svg.appendChild(facadeR);

        // Three cornice lines across the facade (jsesh uses 0.1, 0.3,
        // 0.4 of the facade length — first is bold, others fine).
        const dy = yFacadeEnd - yTop;
        const cornice1 = document.createElementNS(svgNS, "path");
        const c1y = yTop + dy * 0.1;
        cornice1.setAttribute(
          "d",
          `M ${xLeft} ${c1y} L ${xRight} ${c1y}`,
        );
        cornice1.setAttribute("style", strokeStyle);
        svg.appendChild(cornice1);
        const cornice2 = document.createElementNS(svgNS, "path");
        const c2y = yTop + dy * 0.3;
        cornice2.setAttribute(
          "d",
          `M ${xLeft} ${c2y} L ${xRight} ${c2y}`,
        );
        cornice2.setAttribute("style", fineStyle);
        svg.appendChild(cornice2);
        const cornice3 = document.createElementNS(svgNS, "path");
        const c3y = yTop + dy * 0.4;
        cornice3.setAttribute(
          "d",
          `M ${xLeft} ${c3y} L ${xRight} ${c3y}`,
        );
        cornice3.setAttribute("style", fineStyle);
        svg.appendChild(cornice3);

        // Recesses: 3 bands across the facade body, each with an inner
        // notch. JSesh iterates i=1..10 step 3 over a 10-band split.
        const recessY = yTop + dy * 0.5;
        const recessSpan = yFacadeEnd - recessY;
        const dx = xRight - xLeft;
        for (let i = 1; i < 10; i += 3) {
          const x1 = xLeft + 0.1 * dx * i;
          const x2 = xLeft + 0.1 * dx * (i + 1);
          const x3 = xLeft + 0.1 * dx * (i + 2);
          const recess = document.createElementNS(svgNS, "path");
          recess.setAttribute(
            "d",
            `M ${x1} ${yFacadeEnd} L ${x1} ${recessY} L ${x3} ${recessY} L ${x3} ${yFacadeEnd}`,
          );
          recess.setAttribute("style", fineStyle);
          svg.appendChild(recess);
          const innerY = recessY + 0.2 * recessSpan;
          const inner = document.createElementNS(svgNS, "path");
          inner.setAttribute(
            "d",
            `M ${x2} ${innerY} L ${x2} ${yFacadeEnd}`,
          );
          inner.setAttribute("style", fineStyle);
          svg.appendChild(inner);
        }

        // --- Hwt-style end cap (bottom) ---
        const bot = document.createElementNS(svgNS, "path");
        bot.setAttribute("d", `M ${xLeft} ${yBot} L ${xRight} ${yBot}`);
        bot.setAttribute("style", strokeStyle);
        svg.appendChild(bot);
        const botL = document.createElementNS(svgNS, "path");
        botL.setAttribute(
          "d",
          `M ${xLeft} ${yHwtStart} L ${xLeft} ${yBot}`,
        );
        botL.setAttribute("style", strokeStyle);
        svg.appendChild(botL);
        const botR = document.createElementNS(svgNS, "path");
        botR.setAttribute(
          "d",
          `M ${xRight} ${yHwtStart} L ${xRight} ${yBot}`,
        );
        botR.setAttribute("style", strokeStyle);
        svg.appendChild(botR);
        const knot = document.createElementNS(svgNS, "path");
        knot.setAttribute(
          "d",
          `M ${xLeft + hwtKnot} ${yHwtStart} L ${xLeft + hwtKnot} ${yHwtStart + hwtKnot} L ${xLeft} ${yHwtStart + hwtKnot}`,
        );
        knot.setAttribute("style", strokeStyle);
        svg.appendChild(knot);
      } else {
        const yTop = 0.5;
        const yBot = H - 0.5;
        const xLeft = 0.5;
        const xRight = W - 0.5;
        const xFacadeEnd = facadeLen;
        const xHwtStart = W - hwtCapLen;

        // Body top / bottom (between palace facade and Hwt cap).
        const top = document.createElementNS(svgNS, "path");
        top.setAttribute(
          "d",
          `M ${xFacadeEnd} ${yTop} L ${xHwtStart} ${yTop}`,
        );
        top.setAttribute("style", strokeStyle);
        svg.appendChild(top);
        const bot = document.createElementNS(svgNS, "path");
        bot.setAttribute(
          "d",
          `M ${xFacadeEnd} ${yBot} L ${xHwtStart} ${yBot}`,
        );
        bot.setAttribute("style", strokeStyle);
        svg.appendChild(bot);

        // --- Palace facade (start cap, left) ---
        const facadeL = document.createElementNS(svgNS, "path");
        facadeL.setAttribute(
          "d",
          `M ${xLeft} ${yTop} L ${xLeft} ${yBot}`,
        );
        facadeL.setAttribute("style", strokeStyle);
        svg.appendChild(facadeL);
        const facadeT = document.createElementNS(svgNS, "path");
        facadeT.setAttribute(
          "d",
          `M ${xLeft} ${yTop} L ${xFacadeEnd} ${yTop}`,
        );
        facadeT.setAttribute("style", strokeStyle);
        svg.appendChild(facadeT);
        const facadeB = document.createElementNS(svgNS, "path");
        facadeB.setAttribute(
          "d",
          `M ${xLeft} ${yBot} L ${xFacadeEnd} ${yBot}`,
        );
        facadeB.setAttribute("style", strokeStyle);
        svg.appendChild(facadeB);

        const dx = xFacadeEnd - xLeft;
        const cornice1 = document.createElementNS(svgNS, "path");
        const c1x = xLeft + dx * 0.1;
        cornice1.setAttribute(
          "d",
          `M ${c1x} ${yTop} L ${c1x} ${yBot}`,
        );
        cornice1.setAttribute("style", strokeStyle);
        svg.appendChild(cornice1);
        const cornice2 = document.createElementNS(svgNS, "path");
        const c2x = xLeft + dx * 0.3;
        cornice2.setAttribute(
          "d",
          `M ${c2x} ${yTop} L ${c2x} ${yBot}`,
        );
        cornice2.setAttribute("style", fineStyle);
        svg.appendChild(cornice2);
        const cornice3 = document.createElementNS(svgNS, "path");
        const c3x = xLeft + dx * 0.4;
        cornice3.setAttribute(
          "d",
          `M ${c3x} ${yTop} L ${c3x} ${yBot}`,
        );
        cornice3.setAttribute("style", fineStyle);
        svg.appendChild(cornice3);

        const recessX = xLeft + dx * 0.5;
        const recessSpan = xFacadeEnd - recessX;
        const dy = yBot - yTop;
        for (let i = 1; i < 10; i += 3) {
          const y1 = yTop + 0.1 * dy * i;
          const y2 = yTop + 0.1 * dy * (i + 1);
          const y3 = yTop + 0.1 * dy * (i + 2);
          const recess = document.createElementNS(svgNS, "path");
          recess.setAttribute(
            "d",
            `M ${xFacadeEnd} ${y1} L ${recessX} ${y1} L ${recessX} ${y3} L ${xFacadeEnd} ${y3}`,
          );
          recess.setAttribute("style", fineStyle);
          svg.appendChild(recess);
          const innerX = recessX + 0.2 * recessSpan;
          const inner = document.createElementNS(svgNS, "path");
          inner.setAttribute(
            "d",
            `M ${innerX} ${y2} L ${xFacadeEnd} ${y2}`,
          );
          inner.setAttribute("style", fineStyle);
          svg.appendChild(inner);
        }

        // --- Hwt-style end cap (right) ---
        const rightCap = document.createElementNS(svgNS, "path");
        rightCap.setAttribute(
          "d",
          `M ${xRight} ${yTop} L ${xRight} ${yBot}`,
        );
        rightCap.setAttribute("style", strokeStyle);
        svg.appendChild(rightCap);
        const rightTop = document.createElementNS(svgNS, "path");
        rightTop.setAttribute(
          "d",
          `M ${xHwtStart} ${yTop} L ${xRight} ${yTop}`,
        );
        rightTop.setAttribute("style", strokeStyle);
        svg.appendChild(rightTop);
        const rightBot = document.createElementNS(svgNS, "path");
        rightBot.setAttribute(
          "d",
          `M ${xHwtStart} ${yBot} L ${xRight} ${yBot}`,
        );
        rightBot.setAttribute("style", strokeStyle);
        svg.appendChild(rightBot);
        const knot = document.createElementNS(svgNS, "path");
        knot.setAttribute(
          "d",
          `M ${xHwtStart} ${yBot - hwtKnot} L ${xHwtStart + hwtKnot} ${yBot - hwtKnot} L ${xHwtStart + hwtKnot} ${yBot}`,
        );
        knot.setAttribute("style", strokeStyle);
        svg.appendChild(knot);
      }
    } else {
      // Enclosure — port of jsesh's EnclosureDrawer. A rectangular frame
      // with square corner bastions plus evenly distributed intermediate
      // bastions on every side. Bastions are filled rectangles that
      // protrude outward from the frame.
      //
      // Shape constants from JSesh's DrawingPreferences:
      //   bDepth   ≈ how far each bastion sticks out from the frame
      //   bLength  ≈ how long each bastion is along the frame side
      // We anchor both to the perp axis so the look is the same
      // regardless of orientation.
      const refPerp = vertical ? W : H;
      const bDepth = Math.max(1.5, refPerp * 0.06);
      const bLength = Math.max(2, refPerp * 0.1);
      const fillStyle = "fill:#000000;stroke:none";

      // Inner frame rectangle (the bastions sit just outside this).
      const xLeft = bDepth;
      const xRight = W - bDepth;
      const yTop = bDepth;
      const yBot = H - bDepth;

      const frame = document.createElementNS(svgNS, "rect");
      frame.setAttribute("x", String(xLeft));
      frame.setAttribute("y", String(yTop));
      frame.setAttribute(
        "width",
        String(Math.max(0, xRight - xLeft)),
      );
      frame.setAttribute(
        "height",
        String(Math.max(0, yBot - yTop)),
      );
      frame.setAttribute("style", strokeStyle);
      svg.appendChild(frame);

      const addBastion = (x: number, y: number, w: number, h: number) => {
        if (w <= 0 || h <= 0) return;
        const r = document.createElementNS(svgNS, "rect");
        r.setAttribute("x", String(x));
        r.setAttribute("y", String(y));
        r.setAttribute("width", String(w));
        r.setAttribute("height", String(h));
        r.setAttribute("style", fillStyle);
        svg.appendChild(r);
      };

      // --- Corner bastions ---
      // Top-left: an L of two filled rects, one going down and one going right.
      addBastion(xLeft - bDepth, yTop - bDepth, bDepth, bDepth + bLength);
      addBastion(xLeft - bDepth, yTop - bDepth, bDepth + bLength, bDepth);
      // Top-right.
      addBastion(xRight, yTop - bDepth, bDepth, bDepth + bLength);
      addBastion(xRight - bLength, yTop - bDepth, bDepth + bLength, bDepth);
      // Bottom-left.
      addBastion(xLeft - bDepth, yBot - bLength, bDepth, bLength);
      addBastion(xLeft - bDepth, yBot, bDepth + bLength, bDepth);
      // Bottom-right.
      addBastion(xRight, yBot - bLength, bDepth, bLength);
      addBastion(xRight - bLength, yBot, bDepth + bLength, bDepth);

      // --- Intermediate bastions, evenly distributed between corners. ---
      // Pattern (from jsesh's BastionDrawingInfo):
      //   n = floor((l - 3b) / 2b)         // number of bastions
      //   skip = (l - n*b) / (n+1)          // gap between bastions
      // where l is the inner side length and b is bLength.
      const placeBastions = (
        innerLen: number,
        place: (offset: number) => void,
      ) => {
        if (innerLen <= 3 * bLength) return;
        const n = Math.floor((innerLen - 3 * bLength) / (2 * bLength));
        if (n <= 0) return;
        const skip = (innerLen - n * bLength) / (n + 1);
        for (let i = 0; i < n; i++) {
          const offset = skip * (i + 1) + bLength * i;
          place(offset);
        }
      };

      // Top side: bastions sticking UP.
      placeBastions(xRight - xLeft, (offset) => {
        addBastion(xLeft + offset, yTop - bDepth, bLength, bDepth);
      });
      // Bottom side: bastions sticking DOWN.
      placeBastions(xRight - xLeft, (offset) => {
        addBastion(xLeft + offset, yBot, bLength, bDepth);
      });
      // Left side: bastions sticking LEFT.
      placeBastions(yBot - yTop, (offset) => {
        addBastion(xLeft - bDepth, yTop + offset, bDepth, bLength);
      });
      // Right side: bastions sticking RIGHT.
      placeBastions(yBot - yTop, (offset) => {
        addBastion(xRight, yTop + offset, bDepth, bLength);
      });
    }

    return svg;
  };

  const applyIconSizeToElement = (iconEl: HTMLElement, size: number) => {
    if (iconEl.dataset.cartouche === "true") {
      const baseSize = Number(iconEl.dataset.baseSize) || iconSize;
      if (baseSize <= 0) return;
      const mode = iconEl.dataset.selectMode || "cartouche";
      const ratio = size / baseSize;

      if (mode === "inner") {
        const storedFitScale = Number(iconEl.dataset.fitScale) || 0.86;
        const idx = Number(iconEl.dataset.selectedInnerIdx ?? "-1");
        const allInner = iconEl.querySelectorAll(
          ".cartouche-icons-container > svg",
        );
        if (idx >= 0 && idx < allInner.length) {
          const svgEl = allInner[idx] as SVGSVGElement;
          const oH = Number(svgEl.dataset.origH) || baseSize;
          const oW = Number(svgEl.dataset.origW) || baseSize;
          svgEl.style.height = `${Math.round(oH * storedFitScale * ratio)}px`;
          svgEl.style.width = `${Math.round(oW * storedFitScale * ratio)}px`;
          // Mark this inner icon as having a custom size so UI can show its own size on reselect
          svgEl.dataset.customSized = "true";
          svgEl.dataset.customSize = String(size);
        }
      } else {
        const origW = Number(iconEl.dataset.origWidth) || baseSize;
        const origH = Number(iconEl.dataset.origHeight) || baseSize;
        const newW = origW * ratio;
        const newH = origH * ratio;

        iconEl.style.width = `${newW}px`;
        iconEl.style.height = `${newH}px`;

        const isVert = iconEl.dataset.vertical === "true";
        const oldSvg = iconEl.querySelector(":scope > svg");
        if (oldSvg) oldSvg.remove();
        const newSvg = buildCartoucheSvg(
          newW,
          newH,
          isVert,
          getCartoucheShape(iconEl),
        );
        iconEl.insertBefore(newSvg, iconEl.firstChild);

        const container = iconEl.querySelector(
          ".cartouche-icons-container",
        ) as HTMLElement;
        if (container) {
          container.style.width = "100%";
          container.style.height = "100%";
          const storedFitScale = Number(iconEl.dataset.fitScale) || 0.86;
          container.querySelectorAll(":scope > svg").forEach((svg) => {
            const svgEl = svg as SVGSVGElement;
            const oH = Number(svgEl.dataset.origH) || baseSize;
            const oW = Number(svgEl.dataset.origW) || baseSize;
            svgEl.style.height = `${Math.round(oH * storedFitScale * ratio)}px`;
            svgEl.style.width = `${Math.round(oW * storedFitScale * ratio)}px`;
          });
        }
      }

      iconEl.dataset.scale = "1";
      return;
    }
    // Merged groups: rebuild layout at the new size
    if (iconEl.classList.contains("merged")) {
      // MagicBox composite: fixed pixel layout inside .merged-inner-scale; scale with global icon size
      if (iconEl.dataset.magicbox === "true") {
        let canonW = Number(iconEl.dataset.magicboxCanonW);
        let canonH = Number(iconEl.dataset.magicboxCanonH);
        const inner =
          (iconEl.querySelector(
            ":scope > .merged-inner-scale",
          ) as HTMLElement | null) ||
          (iconEl.querySelector(":scope > div") as HTMLElement | null);
        if (
          (!Number.isFinite(canonW) ||
            !Number.isFinite(canonH) ||
            canonW <= 0 ||
            canonH <= 0) &&
          inner
        ) {
          const pw = parseFloat(inner.style.width) || inner.offsetWidth;
          const ph = parseFloat(inner.style.height) || inner.offsetHeight;
          if (pw > 0 && ph > 0) {
            canonW = pw;
            canonH = ph;
            iconEl.dataset.magicboxCanonW = String(Math.round(canonW));
            iconEl.dataset.magicboxCanonH = String(Math.round(canonH));
          }
        }
        if (
          !inner ||
          !Number.isFinite(canonW) ||
          !Number.isFinite(canonH) ||
          canonW <= 0 ||
          canonH <= 0
        ) {
          return;
        }
        if (!inner.classList.contains("merged-inner-scale")) {
          inner.classList.add("merged-inner-scale");
        }
        const isColumnMerge = iconEl.dataset.magicboxColumn === "true";
        let scaleF: number;
        let w: number;
        let h: number;
        if (isColumnMerge) {
          const maxComboW = Math.min(90, size);
          const targetW = Math.max(12, size);
          scaleF = canonW > 0 ? targetW / canonW : 1;
          w = targetW;
          h = canonH * scaleF;
          if (h > 90) {
            const hScale = 90 / h;
            scaleF *= hScale;
            h = 90;
            w = Math.min(Math.round(w * hScale), maxComboW);
          }
        } else {
          const maxComboW = Math.min(90, size);
          const targetH = Math.max(12, size);
          const scaleByW = canonW > 0 ? maxComboW / canonW : 1;
          const scaleByH = canonH > 0 ? targetH / canonH : 1;
          scaleF = Math.min(scaleByW, scaleByH);
          w = canonW * scaleF;
          h = canonH * scaleF;
        }
        w = Math.round(w);
        h = Math.round(h);
        const uniform = canonW > 0 ? w / canonW : 1;
        inner.style.width = `${canonW}px`;
        inner.style.height = `${canonH}px`;
        inner.style.transform = `scale(${uniform})`;
        inner.style.transformOrigin = "0 0";
        inner.style.position = "relative";
        iconEl.style.width = `${w}px`;
        iconEl.style.height = `${h}px`;
        if (isColumnMerge) {
          iconEl.style.maxWidth = `${Math.min(90, size)}px`;
          iconEl.style.maxHeight = "90px";
        } else {
          iconEl.style.maxWidth = `${Math.min(90, size)}px`;
          iconEl.style.maxHeight = "";
        }
        iconEl.dataset.baseSize = String(size);
        iconEl.dataset.scale = "1";
        return;
      }

      // Remove old inner-scale wrapper if present
      const oldInner = iconEl.querySelector(
        ".merged-inner-scale",
      ) as HTMLElement;
      if (oldInner) {
        while (oldInner.firstChild)
          iconEl.insertBefore(oldInner.firstChild, oldInner);
        oldInner.remove();
      }

      // Collect the slot spans (each contains a cloned svg-icon)
      const slots = Array.from(
        iconEl.querySelectorAll(":scope > span"),
      ) as HTMLElement[];
      const n = slots.length;
      if (n === 0) return;

      const layout = iconEl.dataset.layout || "vertical";
      const maxComboW = Math.min(90, size);

      // Run through the shared `computeMergedLayout` helper so resize
      // honours the same INTERNAL_GAP (and all other layout decisions)
      // as creation/relayout. This block used to duplicate the math
      // inline and silently dropped the gap, which made the spacing
      // between grouped glyphs collapse to 0 every time the user
      // changed the global icon size.
      const sourceIcons = slots
        .map((slot) => slot.firstElementChild as Element | null)
        .filter((el): el is Element => !!el);
      if (sourceIcons.length !== n) return;

      const layoutResult = computeMergedLayout(
        sourceIcons,
        layout === "horizontal",
        size,
      );
      if (!layoutResult) return;

      const {
        wrapperW,
        wrapperH,
        slotDims,
        columnMergeTargetW,
        columnMergeTargetH,
      } = layoutResult;
      const slotLayout = slotDims;

      if (
        layout === "horizontal" &&
        iconEl.dataset.mergeColumnBox === "true" &&
        columnMergeTargetW !== null &&
        columnMergeTargetH !== null
      ) {
        iconEl.dataset.mergeColTargetW = String(columnMergeTargetW);
        iconEl.dataset.mergeColTargetH = String(columnMergeTargetH);
        iconEl.dataset.mergeColRef = String(size);
      }

      iconEl.style.width = `${wrapperW}px`;
      iconEl.style.height = `${wrapperH}px`;
      if (layout === "horizontal" && iconEl.dataset.mergeColumnBox === "true") {
        iconEl.style.maxWidth = `${maxComboW}px`;
        iconEl.style.maxHeight = `${Math.min(90, size)}px`;
      } else if (layout === "horizontal") {
        iconEl.style.maxWidth = `${maxComboW}px`;
        iconEl.style.maxHeight = "";
      } else {
        iconEl.style.maxWidth = `${maxComboW}px`;
        iconEl.style.maxHeight = "90px";
      }
      iconEl.dataset.baseSize = String(size);
      iconEl.dataset.scale = "1";

      slots.forEach((slot, i) => {
        const { w, h, left, top } = slotLayout[i];

        slot.style.left = `${left}px`;
        slot.style.top = `${top}px`;
        slot.style.width = `${w}px`;
        slot.style.height = `${h}px`;

        const clone = slot.firstElementChild as HTMLElement | null;
        if (clone) {
          // Use the same fitter as creation/relayout so cartouche clones
          // are uniformly scaled (transform: scale on the original-sized
          // cartouche) instead of having their outer width/height clipped
          // while the absolutely-positioned inner glyphs stay anchored to
          // the old cartouche dimensions — that's what made cartouches in
          // merged groups collapse into the top-left corner on size change.
          fitCloneIntoSlot(clone, w, h);
        }
      });
      return;
    }

    const innerSvg = iconEl.querySelector("svg") as SVGElement | null;
    if (innerSvg) {
      innerSvg.removeAttribute("width");
      innerSvg.removeAttribute("height");
      iconEl.dataset.baseSize = String(size);
      iconEl.dataset.scale = "1";
      applyIconDimensionsToElement(iconEl);
      innerSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      return;
    }

    iconEl.dataset.baseSize = String(size);
    iconEl.dataset.scale = "1";
  };

  const handleIconSizeChange = (size: number) => {
    if (!editorCanEdit) return;

    const clamped = Math.min(90, Math.max(12, size));
    setIconSize(clamped);
    const editor = editorRef.current;
    if (!editor) return;

    // Always apply icon size to the whole document (global control).
    // Cartouche + inner icons are treated as a single unit here.
    const allIcons = editor.querySelectorAll(".svg-icon");
    allIcons.forEach((icon) => {
      const el = icon as HTMLElement;

      // Skip icons nested inside a merged group or cartouche — they're handled by their parent
      if (el.closest(".svg-icon.merged") && !el.classList.contains("merged"))
        return;
      if (el.closest(".cartouche-wrapper") && !el.dataset.cartouche) return;

      if (el.dataset.cartouche === "true") {
        const prevMode = el.dataset.selectMode;
        el.dataset.selectMode = "cartouche";
        applyIconSizeToElement(el, clamped);
        if (prevMode) {
          el.dataset.selectMode = prevMode;
        } else {
          delete el.dataset.selectMode;
        }
      } else {
        applyIconSizeToElement(el, clamped);
      }

      // Refresh shading overlay viewBox to match new display dimensions
      const shadingOverlay = el.querySelector(
        ".shading-overlay",
      ) as SVGSVGElement | null;
      if (shadingOverlay) {
        const rect = el.getBoundingClientRect();
        const dW = Math.round(rect.width) || clamped;
        const dH = Math.round(rect.height) || clamped;
        shadingOverlay.setAttribute("viewBox", `0 0 ${dW} ${dH}`);
      }

      // Defer the PNG re-cache so a "select all + change size" doesn't try
      // to allocate one big oversampled canvas + run a synchronous PNG
      // encode for every icon back-to-back. Copy/paste falls back to the
      // SVG data URI if the PNG isn't ready yet.
      scheduleCachePng(el);

      if (el.dataset.cartouche === "true") {
        const innerSvgs = el.querySelectorAll(
          ".cartouche-icons-container > svg",
        ) as NodeListOf<SVGSVGElement>;
        innerSvgs.forEach((inner) => {
          delete inner.dataset.customSized;
          delete inner.dataset.customSize;
          delete inner.dataset.innerMaxSize;
        });
      }
    });

    // Remove any existing inner resize controls after a global change
    editor
      .querySelectorAll(".cartouche-inner-resize-controls")
      .forEach((ctrl) => ctrl.remove());
  };

  const [iconVerticalAlignDefault, setIconVerticalAlignDefault] = useState<
    "top" | "middle" | "bottom"
  >("middle");

  const getPreserveAspectRatio = (
    align: "top" | "middle" | "bottom",
  ): string => {
    switch (align) {
      case "top":
        return "xMidYMin meet";
      case "bottom":
        return "xMidYMax meet";
      default:
        return "xMidYMid meet";
    }
  };

  const applyIconVerticalAlign = (align: "top" | "middle" | "bottom") => {
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    if (!editor) return;
    setIconVerticalAlignDefault(align);
    const par = getPreserveAspectRatio(align);
    const icons = editor.querySelectorAll(".svg-icon");
    icons.forEach((icon) => {
      const el = icon as HTMLElement;
      el.style.verticalAlign = align;
      el.dataset.verticalAlign = align;
      // Position the SVG graphic within its box (fixes whitespace for small icons)
      el.querySelectorAll("svg").forEach((svg) => {
        svg.setAttribute("preserveAspectRatio", par);
      });
    });
  };

  const createSvgWrapper = (
    svgString: string,
    pictureSize?: number,
    align: "top" | "middle" | "bottom" = iconVerticalAlignDefault,
  ) => {
    const wrapper = document.createElement("span");
    wrapper.className = "svg-icon";
    wrapper.contentEditable = "false";
    wrapper.draggable = false;
    wrapper.dataset.id = Math.random().toString(36).substr(2, 9);
    wrapper.dataset.baseSize = String(iconSize);
    const ps = pictureSize ?? 100;
    wrapper.dataset.pictureSize = String(ps);
    wrapper.dataset.verticalAlign = align;
    wrapper.style.cssText = `
      display: inline-block;
      cursor: text;
      margin: 4px 3px;
      vertical-align: ${align};
      transform: ${getSvgTransform()};      `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = svgString;
    const originalSvg = tempDiv.querySelector("svg") as SVGSVGElement | null;

    if (originalSvg) {
      // Render offscreen to compute tight bounding box (eliminates whitespace)
      const offscreen = document.createElement("div");
      offscreen.style.cssText =
        "position:fixed;left:-9999px;top:-9999px;width:500px;height:500px;visibility:hidden;overflow:hidden;";
      const measureSvg = originalSvg.cloneNode(true) as SVGSVGElement;
      measureSvg.removeAttribute("width");
      measureSvg.removeAttribute("height");
      measureSvg.style.width = "500px";
      measureSvg.style.height = "500px";
      offscreen.appendChild(measureSvg);
      document.body.appendChild(offscreen);

      let tightVB: string | null = null;
      let arW = 1;
      let arH = 1;

      try {
        const bbox = measureSvg.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          tightVB = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
          arW = bbox.width;
          arH = bbox.height;
        }
      } catch {
        // getBBox unavailable
      }

      document.body.removeChild(offscreen);

      // Build a clean minimal SVG
      const cleanSvg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      cleanSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      cleanSvg.setAttribute(
        "preserveAspectRatio",
        getPreserveAspectRatio(align),
      );

      if (tightVB) {
        cleanSvg.setAttribute("viewBox", tightVB);
      } else {
        const fallback = originalSvg.getAttribute("viewBox") || "0 0 100 100";
        cleanSvg.setAttribute("viewBox", fallback);
        const parts = fallback.trim().split(/[\s,]+/);
        arW = parseFloat(parts[2]) || 100;
        arH = parseFloat(parts[3]) || 100;
      }

      // Copy only rendering content (defs, g, paths — skip metadata/comments)
      originalSvg
        .querySelectorAll(":scope > defs")
        .forEach((d) => cleanSvg.appendChild(d.cloneNode(true)));

      const groups = originalSvg.querySelectorAll(":scope > g");
      if (groups.length > 0) {
        groups.forEach((g) => cleanSvg.appendChild(g.cloneNode(true)));
      } else {
        originalSvg
          .querySelectorAll(
            ":scope > path, :scope > circle, :scope > rect, :scope > ellipse, :scope > polygon, :scope > polyline, :scope > line, :scope > use",
          )
          .forEach((el) => cleanSvg.appendChild(el.cloneNode(true)));
      }

      wrapper.dataset.arW = String(arW);
      wrapper.dataset.arH = String(arH);
      const { width: initW, height: initH } = getIconLayoutDimensions(
        ps,
        iconSize,
        arW,
        arH,
        columnMode,
      );
      cleanSvg.style.width = `${initW}px`;
      cleanSvg.style.height = `${initH}px`;

      wrapper.appendChild(cleanSvg);
      if (columnMode) {
        applyIconDimensionsToElement(wrapper);
      }
    } else {
      wrapper.innerHTML = svgString;
      const firstSvg = wrapper.querySelector("svg");
      if (firstSvg) {
        const vb = firstSvg.getAttribute("viewBox");
        if (vb) {
          const parts = vb.trim().split(/[\s,]+/);
          const w = parseFloat(parts[2]) || 100;
          const h = parseFloat(parts[3]) || 100;
          wrapper.dataset.arW = String(w);
          wrapper.dataset.arH = String(h);
        }
        firstSvg.setAttribute(
          "preserveAspectRatio",
          getPreserveAspectRatio(align),
        );
      }
      wrapper.querySelectorAll("svg").forEach((svg) => {
        svg.setAttribute("preserveAspectRatio", getPreserveAspectRatio(align));
      });
      applyIconDimensionsToElement(wrapper);
    }

    wrapper.ondragstart = (e) => {
      e.stopPropagation();
      draggedElementRef.current = wrapper;
      dragSourceRef.current = "editor";
      wrapper.style.opacity = "0.5";
    };

    wrapper.ondragend = () => {
      draggedElementRef.current = null;
      dragSourceRef.current = "";
      wrapper.style.opacity = "1";
    };

    scheduleCachePng(wrapper);

    return wrapper;
  };

  const insertSvgAtCursor = (svgString: string, pictureSize?: number) => {
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    if (!editor) return;
    resetTypingHistorySession();
    restoreSavedRangeIfNeeded();
    const wrapper = createSvgWrapper(svgString, pictureSize);
    const sel = window.getSelection();

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(wrapper);

        range.setStartAfter(wrapper);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRangeRef.current = range.cloneRange();
        scrollElementIntoView(wrapper);
      } else {
        editor.appendChild(wrapper);
        scrollElementIntoView(wrapper);
      }
    } else {
      editor.appendChild(wrapper);
      scrollElementIntoView(wrapper);
    }

    editor.focus();
    commitHistory("push");
  };

  const insertImageAtCursor = (dataUrl: string) => {
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    if (!editor) return;
    resetTypingHistorySession();

    const imgWrapper = document.createElement("span");
    imgWrapper.contentEditable = "false";
    imgWrapper.style.cssText = `
      display: inline-block;
      margin: 0 2px;
      vertical-align: middle;
      position: relative;
    `;
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "inserted";
    img.style.width = "120px";
    img.style.height = "auto";
    img.style.maxWidth = "100%";
    img.style.maxHeight = "400px";
    img.style.verticalAlign = "middle";
    img.style.display = "block";
    imgWrapper.appendChild(img);

    // Utility to add 8 resize handles and wire interactions
    const addResizeHandles = (
      wrapper: HTMLSpanElement,
      imageEl: HTMLImageElement,
    ) => {
      type HandleDef = {
        pos: "nw" | "ne" | "se" | "sw";
        cursor: string;
        left?: number;
        right?: number;
        top?: number;
        bottom?: number;
        translateX?: number;
        translateY?: number;
      };
      const handleDefs: HandleDef[] = [
        { pos: "nw", cursor: "nwse-resize", left: -4, top: -4 },
        { pos: "ne", cursor: "nesw-resize", right: -4, top: -4 },
        { pos: "se", cursor: "nwse-resize", right: -4, bottom: -4 },
        { pos: "sw", cursor: "nesw-resize", left: -4, bottom: -4 },
      ];

      const handles: HTMLSpanElement[] = [];

      const showHandles = (visible: boolean) => {
        handles.forEach((h) => (h.style.display = visible ? "block" : "none"));
        wrapper.style.outline = visible ? "2px solid #3b82f6" : "none";
        wrapper.style.outlineOffset = visible ? "2px" : "0";
      };

      const startResize =
        (pos: (typeof handleDefs)[number]["pos"]) => (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startY = e.clientY;
          const rect = imageEl.getBoundingClientRect();
          const startWidth = rect.width;
          const startHeight = rect.height;
          const aspect = startWidth / startHeight || 1;

          const affects = {
            n: pos.includes("n"),
            s: pos.includes("s"),
            e: pos.includes("e"),
            w: pos.includes("w"),
          };

          const onMove = (ev: MouseEvent) => {
            ev.preventDefault();
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;

            let widthDelta = 0;
            let heightDelta = 0;
            if (affects.e) widthDelta += dx;
            if (affects.w) widthDelta -= dx;
            if (affects.s) heightDelta += dy;
            if (affects.n) heightDelta -= dy;

            let newWidth = Math.max(24, Math.round(startWidth + widthDelta));
            let newHeight = Math.max(24, Math.round(startHeight + heightDelta));

            if (ev.shiftKey) {
              // preserve aspect ratio based on width change if any, else height
              if (Math.abs(widthDelta) >= Math.abs(heightDelta)) {
                newHeight = Math.round(newWidth / aspect);
              } else {
                newWidth = Math.round(newHeight * aspect);
              }
            }

            imageEl.style.width = `${newWidth}px`;
            imageEl.style.height = `${newHeight}px`;
          };

          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp, true);
          };

          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp, true);
        };

      handleDefs.forEach((def) => {
        const h = document.createElement("span");
        h.title = "Drag to resize";
        h.style.position = "absolute";
        h.style.width = "10px";
        h.style.height = "10px";
        h.style.border = "1px solid white";
        h.style.background = "#3b82f6";
        h.style.boxSizing = "border-box";
        h.style.cursor = def.cursor;
        h.style.zIndex = "2";
        // place
        if (def.left !== undefined) {
          h.style.left = `${def.left}px`;
        }
        if (def.right !== undefined) {
          h.style.right = `${def.right}px`;
        }
        if (def.top !== undefined) {
          h.style.top = `${def.top}px`;
        }
        if (def.bottom !== undefined) {
          h.style.bottom = `${def.bottom}px`;
        }
        if (def.translateX !== undefined) {
          h.style.transform = `translateX(${def.translateX}%)`;
        }
        if (def.translateY !== undefined) {
          const prev = h.style.transform || "";
          h.style.transform = `${prev} translateY(${def.translateY}%)`.trim();
        }
        h.style.display = "none";
        h.addEventListener("mousedown", startResize(def.pos));
        wrapper.appendChild(h);
        handles.push(h);
      });

      // selection behavior
      const onWrapperClick = (e: MouseEvent) => {
        e.stopPropagation();
        showHandles(true);
      };
      wrapper.addEventListener("mousedown", onWrapperClick);

      const onDocClick = (e: MouseEvent) => {
        const target = e.target as Node;
        if (!wrapper.contains(target)) {
          showHandles(false);
        }
      };
      document.addEventListener("mousedown", onDocClick);

      return () => {
        document.removeEventListener("mousedown", onDocClick);
        wrapper.removeEventListener("mousedown", onWrapperClick);
        handles.forEach((h) => h.remove());
      };
    };

    addResizeHandles(imgWrapper, img);

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(imgWrapper);
        range.setStartAfter(imgWrapper);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        scrollElementIntoView(imgWrapper);
      } else {
        editor.appendChild(imgWrapper);
        scrollElementIntoView(imgWrapper);
      }
    } else {
      editor.appendChild(imgWrapper);
      scrollElementIntoView(imgWrapper);
    }

    editor.focus();
    commitHistory("push");
  };

  const insertTextAtCursor = (text: string) => {
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    if (!editor) return;
    resetTypingHistorySession();
    restoreSavedRangeIfNeeded();
    const textNode = document.createTextNode(text);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRangeRef.current = range.cloneRange();
        scrollElementIntoView(textNode);
      } else {
        editor.appendChild(textNode);
        scrollElementIntoView(textNode);
      }
    } else {
      editor.appendChild(textNode);
      scrollElementIntoView(textNode);
    }

    editor.focus();
    commitHistory("push");
  };

  const insertHtmlAtCursor = (html: string) => {
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    if (!editor) return;
    resetTypingHistorySession();
    restoreSavedRangeIfNeeded();

    const sel = window.getSelection();
    // Build nodes from HTML so we can track the last inserted node
    const container = document.createElement("div");
    container.innerHTML = html;
    const nodes: Node[] = Array.from(container.childNodes);

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        let lastNode: Node | null = null;
        nodes.forEach((n) => {
          range.insertNode(n);
          lastNode = n;
          // Move range after each inserted node so next inserts after it
          range.setStartAfter(n);
          range.collapse(true);
        });
        if (lastNode) {
          const newRange = document.createRange();
          newRange.setStartAfter(lastNode);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          savedRangeRef.current = newRange.cloneRange();
          scrollElementIntoView(lastNode);
        }
      } else {
        nodes.forEach((n) => editor.appendChild(n));
        if (nodes.length > 0) {
          scrollElementIntoView(nodes[nodes.length - 1]);
        }
      }
    } else {
      nodes.forEach((n) => editor.appendChild(n));
      if (nodes.length > 0) {
        scrollElementIntoView(nodes[nodes.length - 1]);
      }
    }

    editor.focus();
    commitHistory("push");
  };

  const handlePaletteDragStart = (svgString: string, e: React.DragEvent) => {
    // ... original implementation ...
    if (!editorCanEdit) {
      e.preventDefault();
      return;
    }

    e.dataTransfer.effectAllowed = "copy";
    dragSourceRef.current = "palette";
    e.dataTransfer.setData("text/html", svgString);
    (e.target as HTMLElement).style.opacity = "0.5";
  };

  const handlePaletteDragEnd = (e: React.DragEvent) => {
    // ... original implementation ...
    (e.target as HTMLElement).style.opacity = "1";
    if (dragSourceRef.current === "palette") {
      dragSourceRef.current = "";
    }
  };

  const handleEditorDrop = (e: React.DragEvent) => {
    // ... original implementation ...
    e.preventDefault();
    e.stopPropagation();
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    if (!editor) return;

    const x = e.clientX;
    const y = e.clientY;
    let range: Range | null = null;

    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    } else if (
      (
        document as Document & {
          caretPositionFromPoint?: (
            x: number,
            y: number,
          ) => { offsetNode: Node; offset: number };
        }
      ).caretPositionFromPoint
    ) {
      const typedDoc = document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number,
        ) => { offsetNode: Node; offset: number };
      };
      const caretPos = typedDoc.caretPositionFromPoint?.(x, y);
      if (caretPos) {
        range = document.createRange();
        range.setStart(caretPos.offsetNode, caretPos.offset);
        range.collapse(true);
      }
    }

    if (!range) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    if (dragSourceRef.current === "palette") {
      const svgString = e.dataTransfer.getData("text/html");
      if (svgString) {
        const wrapper = createSvgWrapper(svgString);
        range.insertNode(wrapper);

        range.setStartAfter(wrapper);
        range.collapse(true);
        scrollElementIntoView(wrapper);
      }
    } else if (
      dragSourceRef.current === "editor" &&
      draggedElementRef.current
    ) {
      const draggedElement = draggedElementRef.current;

      draggedElement.remove();
      draggedElement.style.opacity = "1";
      range.insertNode(draggedElement);

      range.setStartAfter(draggedElement);
      range.collapse(true);
      scrollElementIntoView(draggedElement);
    }

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }

    editor.focus();
    resetTypingHistorySession();
    commitHistory("push");
  };

  const handleEditorDragOver = (e: React.DragEvent) => {
    // ... original implementation ...
    e.preventDefault();
    e.dataTransfer.dropEffect =
      dragSourceRef.current === "palette" ? "copy" : "move";
  };

  // === Copy/Paste support for SVG icons ===

  const getSvgContentDimensions = (
    svg: SVGSVGElement,
    cssW: number,
    cssH: number,
  ): { w: number; h: number } => {
    const vb = svg.getAttribute("viewBox");
    if (!vb) return { w: cssW, h: cssH };
    const parts = vb.trim().split(/[\s,]+/);
    if (parts.length < 4) return { w: cssW, h: cssH };
    const vbW = parseFloat(parts[2]);
    const vbH = parseFloat(parts[3]);
    if (!vbW || !vbH || vbW <= 0 || vbH <= 0) return { w: cssW, h: cssH };
    const par = svg.getAttribute("preserveAspectRatio") || "xMidYMid meet";
    if (par === "none") return { w: cssW, h: cssH };
    const scale = par.includes("slice")
      ? Math.max(cssW / vbW, cssH / vbH)
      : Math.min(cssW / vbW, cssH / vbH);
    return {
      w: Math.max(1, Math.round(vbW * scale)),
      h: Math.max(1, Math.round(vbH * scale)),
    };
  };

  const cachePngForSvgIcon = (wrapper: HTMLElement) => {
    const iconId = wrapper.dataset.id;
    if (!iconId) return;

    if (
      wrapper.classList.contains("merged") ||
      wrapper.dataset.cartouche === "true"
    ) {
      cachePngForCompositeIcon(wrapper);
      return;
    }

    // Shading is a second sibling <svg class="shading-overlay">; rasterize all layers like merged icons.
    if (
      wrapper.querySelector(".shading-overlay") ||
      wrapper.querySelectorAll(":scope > svg").length > 1
    ) {
      cachePngForCompositeIcon(wrapper);
      return;
    }

    const svg = wrapper.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const cssW =
      parseInt(svg.style.width) ||
      parseInt(wrapper.dataset.baseSize || "39") ||
      39;
    const cssH = parseInt(svg.style.height) || cssW;
    const { w, h } = getSvgContentDimensions(svg, cssW, cssH);

    const ns = "http://www.w3.org/2000/svg";
    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", ns);
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    clone.style.width = `${w}px`;
    clone.style.height = `${h}px`;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);

    const canvas = document.createElement("canvas");
    canvas.width = w * COPY_SCALE;
    canvas.height = h * COPY_SCALE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const img = new Image();
    img.crossOrigin = "anonymous";
    const blob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, w * COPY_SCALE, h * COPY_SCALE);
      URL.revokeObjectURL(url);
      const raw = canvas.toDataURL("image/png");
      pngCacheRef.current.set(iconId, injectDpiIntoDataUrl(raw, COPY_DPI));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  const cachePngForCompositeIcon = (wrapper: HTMLElement) => {
    const iconId = wrapper.dataset.id;
    if (!iconId) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const baseSize = parseInt(wrapper.dataset.baseSize || "39") || 39;
    const displayW =
      Math.round(wrapperRect.width) ||
      parseInt(wrapper.style.width) ||
      baseSize;
    const displayH =
      Math.round(wrapperRect.height) ||
      parseInt(wrapper.style.height) ||
      baseSize;

    const canvas = document.createElement("canvas");
    canvas.width = displayW * COPY_SCALE;
    canvas.height = displayH * COPY_SCALE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const serializer = new XMLSerializer();
    const allSvgs = wrapper.querySelectorAll("svg");

    const tasks: Array<{
      svgString: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }> = [];

    allSvgs.forEach((svg) => {
      const svgRect = svg.getBoundingClientRect();
      const w = Math.round(svgRect.width);
      const h = Math.round(svgRect.height);
      if (w <= 0 || h <= 0) return;

      const x = Math.round(svgRect.left - wrapperRect.left);
      const y = Math.round(svgRect.top - wrapperRect.top);

      const clone = svg.cloneNode(true) as SVGSVGElement;
      if (!clone.getAttribute("xmlns")) {
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }
      if (!clone.getAttribute("viewBox")) {
        const origW = svg.getAttribute("width") || String(w);
        const origH = svg.getAttribute("height") || String(h);
        clone.setAttribute(
          "viewBox",
          `0 0 ${parseFloat(origW)} ${parseFloat(origH)}`,
        );
      }
      clone.setAttribute("width", String(w));
      clone.setAttribute("height", String(h));
      clone.style.cssText = "";

      tasks.push({
        svgString: serializer.serializeToString(clone),
        x,
        y,
        w,
        h,
      });
    });

    if (tasks.length === 0) return;

    let completed = 0;

    tasks.forEach((task) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const blob = new Blob([task.svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        ctx.drawImage(
          img,
          task.x * COPY_SCALE,
          task.y * COPY_SCALE,
          task.w * COPY_SCALE,
          task.h * COPY_SCALE,
        );
        URL.revokeObjectURL(url);
        completed++;
        if (completed === tasks.length) {
          const raw = canvas.toDataURL("image/png");
          pngCacheRef.current.set(iconId, injectDpiIntoDataUrl(raw, COPY_DPI));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        completed++;
      };

      img.src = url;
    });
  };

  // Defer + chunk PNG re-caching so a single user action (e.g. global
  // icon-size change applied to dozens of icons) doesn't allocate dozens
  // of large canvases or run dozens of synchronous toDataURL encodes
  // back-to-back. See pngCacheQueueRef for the rationale.
  const PNG_FLUSH_CHUNK = 4;
  const PNG_FLUSH_TIMEOUT_MS = 1500;

  const flushPngCacheQueue = (deadline?: IdleDeadline) => {
    pngCacheScheduledRef.current = null;
    const editor = editorRef.current;
    const queue = pngCacheQueueRef.current;
    if (!editor || queue.size === 0) {
      queue.clear();
      return;
    }

    // Drop cache entries whose data-id is no longer present in the editor.
    // Merge / relayout / cartouche-rebuild operations assign brand new ids,
    // leaving the old PNG strings stranded in the Map forever. We only
    // sweep occasionally to keep the cost bounded.
    if (queue.size > 0 && pngCacheRef.current.size > 0) {
      const liveIds = new Set<string>();
      editor.querySelectorAll<HTMLElement>(".svg-icon").forEach((el) => {
        if (el.dataset.id) liveIds.add(el.dataset.id);
      });
      pngCacheRef.current.forEach((_, id) => {
        if (!liveIds.has(id)) pngCacheRef.current.delete(id);
      });
    }

    let processed = 0;
    const hasIdleBudget = () =>
      deadline ? deadline.timeRemaining() > 4 : processed < PNG_FLUSH_CHUNK;

    const iterator = queue.entries();
    while (hasIdleBudget()) {
      const next = iterator.next();
      if (next.done) break;
      const [id, el] = next.value;
      queue.delete(id);
      processed += 1;
      // The wrapper may have been replaced (merge / relayout) since we
      // queued it; only rasterize what's still in the live editor.
      if (!editor.contains(el)) continue;
      if (el.dataset.id !== id) continue;
      cachePngForSvgIcon(el);
    }

    if (queue.size > 0) {
      schedulePngFlush();
    }
  };

  const schedulePngFlush = () => {
    if (pngCacheScheduledRef.current !== null) return;
    const w = window as Window & {
      requestIdleCallback?: (
        cb: (deadline: IdleDeadline) => void,
        opts?: { timeout: number },
      ) => number;
    };
    if (typeof w.requestIdleCallback === "function") {
      pngCacheScheduledRef.current = w.requestIdleCallback(
        flushPngCacheQueue,
        { timeout: PNG_FLUSH_TIMEOUT_MS },
      );
    } else {
      pngCacheScheduledRef.current = window.setTimeout(
        () => flushPngCacheQueue(),
        80,
      );
    }
  };

  // Public entry point for "I would like this icon's PNG cached eventually".
  // Coalesces repeated calls per data-id so rapid size changes don't pile up.
  const scheduleCachePng = (el: HTMLElement) => {
    const id = el.dataset.id;
    if (!id) return;
    pngCacheQueueRef.current.set(id, el);
    schedulePngFlush();
  };

  const reconstructSvgIcon = (originalEl: HTMLElement): HTMLElement => {
    const clone = originalEl.cloneNode(true) as HTMLElement;
    clone.dataset.id = Math.random().toString(36).substr(2, 9);
    clone.style.backgroundColor = "";
    clone.style.outline = "";
    clone.style.outlineOffset = "";
    clone.ondragstart = (ev) => {
      ev.stopPropagation();
      draggedElementRef.current = clone;
      dragSourceRef.current = "editor";
      clone.style.opacity = "0.5";
    };
    clone.ondragend = () => {
      draggedElementRef.current = null;
      dragSourceRef.current = "";
      clone.style.opacity = "1";
    };
    clone.querySelectorAll(".svg-icon").forEach((child) => {
      (child as HTMLElement).dataset.id = Math.random()
        .toString(36)
        .substr(2, 9);
    });
    scheduleCachePng(clone);
    return clone;
  };

  const buildIconSvgElement = (iconEl: HTMLElement): SVGSVGElement | null => {
    const baseSize = parseInt(iconEl.dataset.baseSize || "39") || 39;
    const ns = "http://www.w3.org/2000/svg";

    const isMerged = iconEl.classList.contains("merged");
    const isCartouche = iconEl.dataset.cartouche === "true";

    if (isMerged || isCartouche) {
      const wrapperRect = iconEl.getBoundingClientRect();
      const displayW =
        Math.round(wrapperRect.width) ||
        parseInt(iconEl.style.width) ||
        baseSize;
      const displayH =
        Math.round(wrapperRect.height) ||
        parseInt(iconEl.style.height) ||
        baseSize;

      const allSvgs = iconEl.querySelectorAll("svg");
      if (allSvgs.length === 0) return null;

      const outer = document.createElementNS(ns, "svg");
      outer.setAttribute("xmlns", ns);
      outer.setAttribute("width", String(displayW));
      outer.setAttribute("height", String(displayH));
      outer.setAttribute("viewBox", `0 0 ${displayW} ${displayH}`);

      const bg = document.createElementNS(ns, "rect");
      bg.setAttribute("width", String(displayW));
      bg.setAttribute("height", String(displayH));
      bg.setAttribute("fill", "white");
      outer.appendChild(bg);

      allSvgs.forEach((svg) => {
        const svgRect = svg.getBoundingClientRect();
        const sw = Math.round(svgRect.width);
        const sh = Math.round(svgRect.height);
        if (sw <= 0 || sh <= 0) return;

        const sx = Math.round(svgRect.left - wrapperRect.left);
        const sy = Math.round(svgRect.top - wrapperRect.top);

        const clone = svg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute("x", String(sx));
        clone.setAttribute("y", String(sy));
        clone.setAttribute("width", String(sw));
        clone.setAttribute("height", String(sh));
        clone.removeAttribute("style");
        outer.appendChild(clone);
      });

      return outer;
    }

    const directSvgs = iconEl.querySelectorAll(":scope > svg");
    if (iconEl.querySelector(".shading-overlay") || directSvgs.length > 1) {
      const wrapperRect = iconEl.getBoundingClientRect();
      const displayW =
        Math.round(wrapperRect.width) ||
        parseInt(iconEl.style.width) ||
        baseSize;
      const displayH =
        Math.round(wrapperRect.height) ||
        parseInt(iconEl.style.height) ||
        baseSize;

      if (directSvgs.length === 0) return null;

      const outer = document.createElementNS(ns, "svg");
      outer.setAttribute("xmlns", ns);
      outer.setAttribute("width", String(displayW));
      outer.setAttribute("height", String(displayH));
      outer.setAttribute("viewBox", `0 0 ${displayW} ${displayH}`);

      const bg = document.createElementNS(ns, "rect");
      bg.setAttribute("width", String(displayW));
      bg.setAttribute("height", String(displayH));
      bg.setAttribute("fill", "white");
      outer.appendChild(bg);

      directSvgs.forEach((svg) => {
        const svgRect = svg.getBoundingClientRect();
        const sw = Math.round(svgRect.width);
        const sh = Math.round(svgRect.height);
        if (sw <= 0 || sh <= 0) return;

        const sx = Math.round(svgRect.left - wrapperRect.left);
        const sy = Math.round(svgRect.top - wrapperRect.top);

        const clone = svg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute("x", String(sx));
        clone.setAttribute("y", String(sy));
        clone.setAttribute("width", String(sw));
        clone.setAttribute("height", String(sh));
        clone.removeAttribute("style");
        outer.appendChild(clone);
      });

      return outer;
    }

    const cssW = parseInt(iconEl.style.width) || baseSize;
    const cssH = parseInt(iconEl.style.height) || baseSize;
    const svg = iconEl.querySelector(":scope > svg") as SVGSVGElement | null;
    if (!svg) return null;

    const { w, h } = getSvgContentDimensions(svg, cssW, cssH);

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", ns);
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    clone.style.width = `${w}px`;
    clone.style.height = `${h}px`;

    return clone;
  };

  const iconToSvgDataUri = (iconEl: HTMLElement): string | null => {
    const svgEl = buildIconSvgElement(iconEl);
    if (!svgEl) return null;
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
  };

  const iconToSvgString = (iconEl: HTMLElement): string | null => {
    const svgEl = buildIconSvgElement(iconEl);
    if (!svgEl) return null;
    return new XMLSerializer().serializeToString(svgEl);
  };

  const buildCompositeSvgString = (iconEls: HTMLElement[]): string | null => {
    if (iconEls.length === 0) return null;

    const ns = "http://www.w3.org/2000/svg";
    const gap = 4;
    const entries: { svgStr: string; w: number; h: number }[] = [];

    for (const el of iconEls) {
      const svgStr = iconToSvgString(el);
      if (!svgStr) continue;
      const baseSize = parseInt(el.dataset.baseSize || "39") || 39;
      const isComp =
        el.classList.contains("merged") || el.dataset.cartouche === "true";
      let w: number;
      let h: number;
      if (!isComp) {
        const liveSvg = el.querySelector(
          ":scope > svg",
        ) as SVGSVGElement | null;
        if (liveSvg) {
          const cssW = parseInt(liveSvg.style.width) || baseSize;
          const cssH = parseInt(liveSvg.style.height) || cssW;
          const dims = getSvgContentDimensions(liveSvg, cssW, cssH);
          w = dims.w;
          h = dims.h;
        } else {
          const rect = el.getBoundingClientRect();
          w = Math.round(rect.width) || parseInt(el.style.width) || baseSize;
          h = Math.round(rect.height) || parseInt(el.style.height) || baseSize;
        }
      } else {
        const rect = el.getBoundingClientRect();
        w = Math.round(rect.width) || parseInt(el.style.width) || baseSize;
        h = Math.round(rect.height) || parseInt(el.style.height) || baseSize;
      }
      entries.push({ svgStr, w, h });
    }
    if (entries.length === 0) return null;

    const totalW =
      entries.reduce((s, e) => s + e.w, 0) + (entries.length - 1) * gap;
    const maxH = Math.max(...entries.map((e) => e.h));

    let compositeInner = "";
    let x = 0;
    for (const entry of entries) {
      const y = (maxH - entry.h) / 2;
      compositeInner +=
        `<image x="${x}" y="${y}" width="${entry.w}" height="${entry.h}" ` +
        `href="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(entry.svgStr)))}" />`;
      x += entry.w + gap;
    }

    return (
      `<svg xmlns="${ns}" width="${totalW}" height="${maxH}" viewBox="0 0 ${totalW} ${maxH}">` +
      compositeInner +
      `</svg>`
    );
  };

  // Oversampling factor when rasterizing SVGs to PNG for the copy clipboard.
  // 4x is enough for ~Retina sharpness and keeps each canvas small enough
  // that batch re-caching (e.g. on a global icon-size change) doesn't blow
  // up RAM or stall on toDataURL. Bumping this back to 8 multiplies canvas
  // memory and PNG-encoding time by ~4x per icon.
  const COPY_SCALE = 4;
  const COPY_DPI = 96 * COPY_SCALE;

  const injectDpiIntoDataUrl = (dataUrl: string, dpi: number): string => {
    const b64 = dataUrl.split(",")[1];
    if (!b64) return dataUrl;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return pngBytesToDataUrl(new Uint8Array(injectPngDpi(bytes.buffer, dpi)));
  };

  const pngCrc32 = (data: Uint8Array): number => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++)
      crc = t[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };

  const injectPngDpi = (buf: ArrayBuffer, dpi: number): ArrayBuffer => {
    const src = new Uint8Array(buf);
    const ihdrLen = new DataView(buf).getUint32(8);
    const pos = 8 + 4 + 4 + ihdrLen + 4;
    const ppu = Math.round(dpi / 0.0254);
    const ch = new Uint8Array(21);
    const dv = new DataView(ch.buffer);
    dv.setUint32(0, 9);
    ch[4] = 0x70;
    ch[5] = 0x48;
    ch[6] = 0x59;
    ch[7] = 0x73;
    dv.setUint32(8, ppu);
    dv.setUint32(12, ppu);
    ch[16] = 1;
    dv.setUint32(17, pngCrc32(ch.subarray(4, 17)));
    const out = new Uint8Array(src.length + 21);
    out.set(src.subarray(0, pos));
    out.set(ch, pos);
    out.set(src.subarray(pos), pos + 21);
    return out.buffer;
  };

  const pngBytesToDataUrl = (bytes: Uint8Array): string => {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return `data:image/png;base64,${btoa(s)}`;
  };

  const convertSvgIconsToImages = (html: string): string => {
    const container = document.createElement("div");
    container.innerHTML = html;
    const topIcons = Array.from(container.querySelectorAll(".svg-icon")).filter(
      (el) => !el.parentElement?.closest(".svg-icon"),
    ) as HTMLElement[];

    const editor = editorRef.current;

    topIcons.forEach((iconEl) => {
      const el = iconEl as HTMLElement;
      const iconId = el.dataset.id;

      const liveEl =
        iconId && editor
          ? (editor.querySelector(
              `.svg-icon[data-id="${iconId}"]`,
            ) as HTMLElement | null)
          : null;
      const liveRect = liveEl ? liveEl.getBoundingClientRect() : null;

      const baseSize = parseInt(el.dataset.baseSize || "39") || 39;
      const isComposite =
        el.classList.contains("merged") || el.dataset.cartouche === "true";

      let displayW: number;
      let displayH: number;

      if (!isComposite) {
        const sourceEl = liveEl || el;
        const liveSvg = sourceEl.querySelector(
          ":scope > svg",
        ) as SVGSVGElement | null;
        if (liveSvg) {
          const cssW = parseInt(liveSvg.style.width) || baseSize;
          const cssH = parseInt(liveSvg.style.height) || cssW;
          const dims = getSvgContentDimensions(liveSvg, cssW, cssH);
          displayW = dims.w;
          displayH = dims.h;
        } else {
          displayW =
            (liveRect && Math.round(liveRect.width)) ||
            parseInt(el.style.width) ||
            baseSize;
          displayH =
            (liveRect && Math.round(liveRect.height)) ||
            parseInt(el.style.height) ||
            baseSize;
        }
      } else {
        displayW =
          (liveRect && Math.round(liveRect.width)) ||
          parseInt(el.style.width) ||
          baseSize;
        displayH =
          (liveRect && Math.round(liveRect.height)) ||
          parseInt(el.style.height) ||
          baseSize;
      }

      const pngDataUrl = iconId ? pngCacheRef.current.get(iconId) : undefined;

      const applyImgStyle = (img: HTMLImageElement) => {
        img.setAttribute("width", String(displayW));
        img.setAttribute("height", String(displayH));
        img.style.cssText = [
          `width:${displayW}px`,
          `height:${displayH}px`,
          `max-width:${displayW}px`,
          `max-height:${displayH}px`,
          `vertical-align:middle`,
          `display:inline-block`,
          `margin:4px 2px`,
        ].join(";");
      };

      if (pngDataUrl) {
        const img = document.createElement("img");
        img.src = pngDataUrl;
        applyImgStyle(img);
        iconEl.parentNode?.replaceChild(img, iconEl);
        return;
      }

      const sourceEl = liveEl || el;
      const svgDataUri = iconToSvgDataUri(sourceEl);
      if (!svgDataUri) return;
      const img = document.createElement("img");
      img.src = svgDataUri;
      applyImgStyle(img);
      iconEl.parentNode?.replaceChild(img, iconEl);
    });
    return container.innerHTML;
  };

  const buildCopyClipboardHtml = (iconsHtml: string): string => {
    const originalEncoded = btoa(unescape(encodeURIComponent(iconsHtml)));
    const wordHtml = convertSvgIconsToImages(iconsHtml);
    return (
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"' +
      ' xmlns:w="urn:schemas-microsoft-com:office:word"' +
      ' xmlns="http://www.w3.org/TR/REC-html40">' +
      "<head>" +
      '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">' +
      "<!--[if gte mso 9]><xml><o:OfficeDocumentSettings>" +
      "<o:AllowPNG/>" +
      "<o:PixelsPerInch>96</o:PixelsPerInch>" +
      "</o:OfficeDocumentSettings></xml><![endif]-->" +
      "</head><body>" +
      `<span data-svg-editor-content="true" style="display:none">${originalEncoded}</span>` +
      wordHtml +
      "</body></html>"
    );
  };

  const writeEnhancedClipboard = async (
    clipboardHtml: string,
    iconsHtml: string,
  ) => {
    try {
      if (!navigator.clipboard?.write) return;

      const htmlBlob = new Blob([clipboardHtml], { type: "text/html" });
      const textBlob = new Blob([""], { type: "text/plain" });

      const clipboardItems: Record<string, Blob> = {
        "text/html": htmlBlob,
        "text/plain": textBlob,
      };

      const supportsSvg =
        typeof ClipboardItem.supports === "function" &&
        ClipboardItem.supports("image/svg+xml");
      if (supportsSvg) {
        const editor = editorRef.current;
        if (editor) {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = iconsHtml;
          const iconEls = Array.from(
            tempDiv.querySelectorAll(".svg-icon"),
          ).filter(
            (el) => !el.parentElement?.closest(".svg-icon"),
          ) as HTMLElement[];
          const liveEls = iconEls
            .map((el) => {
              const id = (el as HTMLElement).dataset.id;
              if (!id) return null;
              return editor.querySelector(
                `.svg-icon[data-id="${id}"]`,
              ) as HTMLElement | null;
            })
            .filter((el): el is HTMLElement => !!el);
          const svgStr = buildCompositeSvgString(liveEls);
          if (svgStr) {
            clipboardItems["image/svg+xml"] = new Blob([svgStr], {
              type: "image/svg+xml",
            });
          }
        }
      }

      await navigator.clipboard.write([new ClipboardItem(clipboardItems)]);
    } catch {
      // Silently fail - synchronous clipboard data is the fallback
    }
  };

  const handleEditorCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    let iconsHtml = "";

    if (selectedIcons.length > 0) {
      const sorted = [...selectedIcons].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      );
      iconsHtml = sorted
        .map((icon) => {
          const clone = icon.cloneNode(true) as HTMLElement;
          clone.style.backgroundColor = "";
          return clone.outerHTML;
        })
        .join("");
    } else {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;
      const fragment = range.cloneContents();
      const tempDiv = document.createElement("div");
      tempDiv.appendChild(fragment);
      if (tempDiv.querySelectorAll(".svg-icon").length === 0) return;
      tempDiv.querySelectorAll(".svg-icon").forEach((icon) => {
        (icon as HTMLElement).style.backgroundColor = "";
      });
      iconsHtml = tempDiv.innerHTML;
    }

    if (!iconsHtml) return;
    e.preventDefault();

    const clipboardHtml = buildCopyClipboardHtml(iconsHtml);
    e.clipboardData.setData("text/html", clipboardHtml);
    e.clipboardData.setData("text/plain", "");

    writeEnhancedClipboard(clipboardHtml, iconsHtml);
  };

  const handleEditorCut = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!editorCanEdit) {
      e.preventDefault();
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    let iconsHtml = "";

    if (selectedIcons.length > 0) {
      const sorted = [...selectedIcons].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      );
      iconsHtml = sorted
        .map((icon) => {
          const clone = icon.cloneNode(true) as HTMLElement;
          clone.style.backgroundColor = "";
          return clone.outerHTML;
        })
        .join("");

      if (!iconsHtml) return;
      e.preventDefault();

      const clipboardHtml = buildCopyClipboardHtml(iconsHtml);
      e.clipboardData.setData("text/html", clipboardHtml);
      e.clipboardData.setData("text/plain", "");
      writeEnhancedClipboard(clipboardHtml, iconsHtml);

      sorted.forEach((icon) => icon.remove());
      setSelectedIcons([]);
      setSelectedIconCount(0);
    } else {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;
      const fragment = range.cloneContents();
      const tempDiv = document.createElement("div");
      tempDiv.appendChild(fragment);
      if (tempDiv.querySelectorAll(".svg-icon").length === 0) return;
      tempDiv.querySelectorAll(".svg-icon").forEach((icon) => {
        (icon as HTMLElement).style.backgroundColor = "";
      });
      iconsHtml = tempDiv.innerHTML;

      if (!iconsHtml) return;
      e.preventDefault();

      const clipboardHtml = buildCopyClipboardHtml(iconsHtml);
      e.clipboardData.setData("text/html", clipboardHtml);
      e.clipboardData.setData("text/plain", "");
      writeEnhancedClipboard(clipboardHtml, iconsHtml);

      range.deleteContents();
    }

    editor.focus();
    resetTypingHistorySession();
    commitHistory("push");
  };

  const decodeClipboardPayloadB64 = (b64: string): string => {
    try {
      const bin = atob(b64.trim());
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return "";
    }
  };

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!editorCanEdit) {
      e.preventDefault();
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    const html = e.clipboardData.getData("text/html");
    if (!html) return;

    let svgHtml = "";

    const tempParse = document.createElement("div");
    tempParse.innerHTML = html;
    const editorContent = tempParse.querySelector(
      "[data-svg-editor-content]",
    ) as HTMLElement | null;

    if (editorContent) {
      const raw = editorContent.textContent || "";
      svgHtml = raw ? decodeClipboardPayloadB64(raw) : "";
    }

    if (!svgHtml) {
      if (tempParse.querySelectorAll(".svg-icon").length > 0) {
        svgHtml = tempParse.innerHTML;
      } else {
        return;
      }
    }

    e.preventDefault();

    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = svgHtml;

    restoreSavedRangeIfNeeded();

    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const canInsertInRange =
      range && editor.contains(range.commonAncestorContainer);

    if (canInsertInRange && range) {
      range.deleteContents();
    }

    let lastNode: Node | null = null;

    Array.from(tempContainer.childNodes).forEach((node) => {
      let nodeToInsert: Node;

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.classList.contains("svg-icon")) {
          nodeToInsert = reconstructSvgIcon(el);
        } else {
          nodeToInsert = node.cloneNode(true);
        }
      } else {
        nodeToInsert = node.cloneNode(true);
      }

      if (canInsertInRange && range) {
        range.insertNode(nodeToInsert);
        range.setStartAfter(nodeToInsert);
        range.collapse(true);
      } else {
        editor.appendChild(nodeToInsert);
      }

      lastNode = nodeToInsert;
    });

    if (lastNode) {
      const newRange = document.createRange();
      newRange.setStartAfter(lastNode);
      newRange.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();
      scrollElementIntoView(lastNode);
    }

    editor.focus();
    resetTypingHistorySession();
    commitHistory("push");
  };

  // ----- Merged-group layout (Group button) -----
  //
  // A merged group's *internal* layout is the opposite of its surrounding
  // text orientation: when text is horizontal, the group stacks glyphs
  // vertically (a quadrat); when text is vertical (i.e. the group lives
  // inside a `.vertical-run`), the group lays glyphs out horizontally
  // (side by side). This mirrors JSesh's behavior: the group is always
  // perpendicular to the line direction.
  //
  // To make this dynamic — so flipping a section's orientation flips its
  // groups too — the layout math is extracted from `createMergedIcon`
  // into a pure helper, and an in-place `relayoutMergedIcon` reuses it
  // to update an existing wrapper's slots.

  type MergedSlot = { w: number; h: number; left: number; top: number };
  type MergedLayout = {
    wrapperW: number;
    wrapperH: number;
    slotDims: MergedSlot[];
    columnMergeTargetW: number | null;
    columnMergeTargetH: number | null;
  };

  const computeMergedLayout = (
    icons: Element[],
    horizontal: boolean,
    baseSize: number,
  ): MergedLayout | null => {
    const n = icons.length;
    if (n < 2) return null;

    const maxComboW = Math.min(90, baseSize);

    // Pixel gap between adjacent glyph slots. Keeps grouped glyphs
    // visibly separate (matching JSesh's grouped-quadrat spacing) instead
    // of rendering them flush against each other. Held in *screen* pixels —
    // the gap is intentionally NOT scaled when slot content shrinks, so a
    // cartouche stacked with a tall glyph still has a visible separator.
    const INTERNAL_GAP = 6;

    let wrapperW: number;
    let wrapperH: number;
    let slotDims: MergedSlot[];
    let columnMergeTargetW: number | null = null;
    let columnMergeTargetH: number | null = null;

    const readAspectRatios = (): number[] =>
      icons.map((icon) => {
        const el = icon as HTMLElement;
        const svg = el.querySelector("svg") as SVGSVGElement | null;
        if (svg) {
          const vb = svg.getAttribute("viewBox");
          if (vb) {
            const parts = vb.trim().split(/[\s,]+/);
            const vbW = parseFloat(parts[2]) || 1;
            const vbH = parseFloat(parts[3]) || 1;
            return vbW / vbH;
          }
          const sw = parseFloat(svg.style.width) || baseSize;
          const sh = parseFloat(svg.style.height) || baseSize;
          return sw / sh;
        }
        const ew = parseFloat(el.style.width) || baseSize;
        const eh = parseFloat(el.style.height) || baseSize;
        return ew / eh;
      });

    if (horizontal) {
      // Side-by-side: anchor the target box to baseSize × baseSize. We
      // intentionally don't measure the source icons' bounding rects —
      // for relayouts, the sources are already slot-sized clones, and
      // reading their rects produces a shrunken box. baseSize keeps the
      // group's horizontal dimensions stable across orientation flips.
      const targetW = Math.round(Math.min(90, Math.max(12, baseSize)));
      const targetH = Math.round(Math.min(90, Math.max(12, baseSize)));
      columnMergeTargetW = targetW;
      columnMergeTargetH = targetH;

      const aspectRatios = readAspectRatios();
      const heightCap = Math.min(90, baseSize);
      const desiredH = Math.min(targetH, heightCap);

      const rawWidths = aspectRatios.map((ar) => desiredH * ar);
      const totalW = rawWidths.reduce((s, w) => s + w, 0);
      const totalGapsW = (n - 1) * INTERNAL_GAP;
      const usableW = Math.max(1, targetW - totalGapsW);
      const scale = totalW > usableW ? usableW / totalW : 1;
      const finalH = desiredH * scale;
      const contentW = totalW * scale + totalGapsW;
      const offsetX = (targetW - contentW) / 2;
      const offsetY = 0;

      wrapperW = targetW;
      wrapperH = Math.max(1, Math.round(finalH));

      let cursor = offsetX;
      slotDims = rawWidths.map((rw) => {
        const sw = rw * scale;
        const dim = { w: sw, h: finalH, left: cursor, top: offsetY };
        cursor += sw + INTERNAL_GAP;
        return dim;
      });
    } else {
      // Vertical stack: wrapper width = baseSize; max total height 90px
      // (mirrors the horizontal max-width cap).
      const MAX_GROUP_H = 90;
      const aspectRatios = readAspectRatios();

      // Gap is held in *screen* pixels and is never scaled with content.
      // Earlier the gap was multiplied by `wScale`/`hScale`, which made
      // tall cartouches inside vertical groups end up with a sub-pixel
      // gap to their neighbours (effectively touching).
      const gapH = INTERNAL_GAP;
      const totalGapsH = (n - 1) * gapH;
      const slotH0 = Math.max(1, (baseSize - totalGapsH) / n);
      const rawWidths = aspectRatios.map((ar) => slotH0 * ar);
      const maxRw = Math.max(...rawWidths, 1);
      const wScale = maxRw > baseSize ? baseSize / maxRw : 1;
      let slotH = slotH0 * wScale;
      let scaledWidths = rawWidths.map((w) => w * wScale);
      wrapperW = baseSize;
      wrapperH = n * slotH + totalGapsH;

      if (wrapperH > MAX_GROUP_H) {
        // Re-derive slotH so wrapperH fits MAX_GROUP_H, *with the gap
        // preserved*. Without this guard, a very tall stack would push
        // the slots into negative height — bail to a 1px floor in that
        // pathological case.
        const availForSlots = Math.max(1, MAX_GROUP_H - totalGapsH);
        const hScale = availForSlots / (n * slotH);
        slotH = Math.max(1, slotH * hScale);
        scaledWidths = scaledWidths.map((w) => w * hScale);
        wrapperW = Math.min(Math.round(baseSize * hScale), maxComboW);
        wrapperH = MAX_GROUP_H;
      }

      slotDims = scaledWidths.map((slotW, i) => ({
        w: slotW,
        h: slotH,
        left: (wrapperW - slotW) / 2,
        top: i * (slotH + gapH),
      }));

      const minL = Math.min(...slotDims.map((s) => s.left));
      const maxR = Math.max(...slotDims.map((s) => s.left + s.w));
      const tightW = Math.max(1, Math.round(maxR - minL));
      slotDims.forEach((s) => {
        s.left -= minL;
      });
      wrapperW = tightW;
    }

    return {
      wrapperW,
      wrapperH,
      slotDims,
      columnMergeTargetW,
      columnMergeTargetH,
    };
  };

  // True iff the merged group at `node` should lay out horizontally —
  // i.e. its line is running vertically (it's inside a .vertical-run).
  const shouldMergedGroupBeHorizontal = (node: Node | null): boolean => {
    if (!node) return false;
    const el =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
    return !!el?.closest(".vertical-run");
  };

  // Fit a cloned glyph into a merged-group slot of size (slotW × slotH).
  //
  // For a regular glyph the inner SVG is inherently scalable (uses
  // viewBox + preserveAspectRatio), so we just resize the wrapper and
  // the SVG element directly.
  //
  // Cartouches are different: their wrapper contains a frame SVG plus a
  // separate `.cartouche-icons-container` whose inner glyph SVGs are
  // absolutely sized in pixels. Resizing only the outer wrapper makes
  // the inner glyphs poke out of the frame (they don't shrink with the
  // wrapper). We instead keep the cartouche's natural dimensions and
  // apply `transform: scale()` to the whole clone so the frame and its
  // inner glyphs scale together, then center the scaled box inside the
  // slot.
  const fitCloneIntoSlot = (
    clone: HTMLElement,
    slotW: number,
    slotH: number,
  ) => {
    const isCartouche = clone.dataset.cartouche === "true";
    if (isCartouche) {
      const origW = Number(clone.dataset.origWidth) || slotW;
      const origH = Number(clone.dataset.origHeight) || slotH;
      const safeOrigW = Math.max(1, origW);
      const safeOrigH = Math.max(1, origH);
      const scale = Math.min(slotW / safeOrigW, slotH / safeOrigH);
      const scaledW = safeOrigW * scale;
      const scaledH = safeOrigH * scale;
      clone.style.cssText = `
        position: absolute;
        top: ${(slotH - scaledH) / 2}px;
        left: ${(slotW - scaledW) / 2}px;
        width: ${safeOrigW}px;
        height: ${safeOrigH}px;
        transform: scale(${scale});
        transform-origin: top left;
      `;
      return;
    }

    clone.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${slotW}px;
      height: ${slotH}px;
    `;
    const inner = clone.querySelector("svg") as SVGElement | null;
    if (inner) {
      inner.removeAttribute("width");
      inner.removeAttribute("height");
      (inner.style as CSSStyleDeclaration).width = `${slotW}px`;
      (inner.style as CSSStyleDeclaration).height = `${slotH}px`;
      inner.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
  };

  const createMergedIcon = (
    icons: Element[],
    options?: { horizontal?: boolean },
  ) => {
    const n = icons.length;
    if (n < 2) return null;

    // Orientation: explicit override > local context (closest vertical-run
    // around the first source icon). We deliberately don't fall back to the
    // global `columnMode`, because per-selection vertical sections can flip
    // orientation independently of the global toggle.
    const horizontal =
      options?.horizontal !== undefined
        ? options.horizontal
        : shouldMergedGroupBeHorizontal(icons[0]);

    const layout = computeMergedLayout(icons, horizontal, iconSize);
    if (!layout) return null;
    const {
      wrapperW,
      wrapperH,
      slotDims,
      columnMergeTargetW,
      columnMergeTargetH,
    } = layout;
    const maxComboW = Math.min(90, iconSize);

    const mergedWrapper = document.createElement("span");
    mergedWrapper.className = "svg-icon merged";
    mergedWrapper.contentEditable = "false";
    // Native HTML5 drag is intentionally off so the browser treats this glyph
    // as part of normal text-style selection (mousedown + drag selects through
    // it, like JSesh). Drag-to-reposition can be re-added later via a custom
    // handle if needed.
    mergedWrapper.draggable = false;
    mergedWrapper.dataset.id = Math.random().toString(36).substr(2, 9);
    mergedWrapper.dataset.baseSize = String(iconSize);
    mergedWrapper.dataset.layout = horizontal ? "horizontal" : "vertical";
    if (
      horizontal &&
      columnMergeTargetW !== null &&
      columnMergeTargetH !== null
    ) {
      mergedWrapper.dataset.mergeColumnBox = "true";
      mergedWrapper.dataset.mergeColTargetW = String(columnMergeTargetW);
      mergedWrapper.dataset.mergeColTargetH = String(columnMergeTargetH);
      mergedWrapper.dataset.mergeColRef = String(iconSize);
    }
    const mergedBoxCap = `max-width: ${maxComboW}px; max-height: 90px;`;
    mergedWrapper.style.cssText = `
        display: inline-block;
        cursor: text;
        margin: 4px 3px;
        vertical-align: middle;
        position: relative;
        width: ${wrapperW}px;
        height: ${wrapperH}px;
        ${mergedBoxCap}
        transform: ${getSvgTransform()};
        `;

    icons.forEach((icon, i) => {
      const { w, h, left, top } = slotDims[i];

      const svgSpan = document.createElement("span");
      svgSpan.style.cssText = `
          position: absolute;
          left: ${left}px;
          top: ${top}px;
          width: ${w}px;
          height: ${h}px;
          overflow: hidden;
          `;

      const svgClone = icon.cloneNode(true) as HTMLElement;
      fitCloneIntoSlot(svgClone, w, h);

      svgSpan.appendChild(svgClone);
      mergedWrapper.appendChild(svgSpan);
    });

    mergedWrapper.ondragstart = (e) => {
      e.stopPropagation();
      draggedElementRef.current = mergedWrapper;
      dragSourceRef.current = "editor";
      mergedWrapper.style.opacity = "0.5";
    };

    mergedWrapper.ondragend = () => {
      draggedElementRef.current = null;
      dragSourceRef.current = "";
      mergedWrapper.style.opacity = "1";
    };

    scheduleCachePng(mergedWrapper);
    return mergedWrapper;
  };

  // Re-flow an existing merged-group wrapper to the requested orientation.
  // Reuses the inner glyph clones, recomputes slot positions, and updates
  // wrapper / slot / inner-svg dimensions in place.
  const relayoutMergedIcon = (
    wrapper: HTMLElement,
    horizontal: boolean,
  ): boolean => {
    // Skip MagicBox-customized groups: their slot positions are user-set
    // and not derived from the line direction.
    if (wrapper.dataset.magicbox === "true") return false;

    const slotSpans = (Array.from(wrapper.children) as Element[]).filter(
      (c): c is HTMLElement => c instanceof HTMLElement,
    );
    if (slotSpans.length < 2) return false;

    const sources = slotSpans
      .map((slot) => slot.firstElementChild as HTMLElement | null)
      .filter((el): el is HTMLElement => !!el);
    if (sources.length !== slotSpans.length) return false;

    const baseSize = Number(wrapper.dataset.baseSize) || iconSize;
    const layout = computeMergedLayout(sources, horizontal, baseSize);
    if (!layout) return false;
    const {
      wrapperW,
      wrapperH,
      slotDims,
      columnMergeTargetW,
      columnMergeTargetH,
    } = layout;

    wrapper.style.width = `${wrapperW}px`;
    wrapper.style.height = `${wrapperH}px`;
    wrapper.dataset.layout = horizontal ? "horizontal" : "vertical";

    if (
      horizontal &&
      columnMergeTargetW !== null &&
      columnMergeTargetH !== null
    ) {
      wrapper.dataset.mergeColumnBox = "true";
      wrapper.dataset.mergeColTargetW = String(columnMergeTargetW);
      wrapper.dataset.mergeColTargetH = String(columnMergeTargetH);
      wrapper.dataset.mergeColRef = String(baseSize);
    } else {
      delete wrapper.dataset.mergeColumnBox;
      delete wrapper.dataset.mergeColTargetW;
      delete wrapper.dataset.mergeColTargetH;
      delete wrapper.dataset.mergeColRef;
    }

    slotSpans.forEach((slot, i) => {
      const dim = slotDims[i];
      if (!dim) return;
      slot.style.left = `${dim.left}px`;
      slot.style.top = `${dim.top}px`;
      slot.style.width = `${dim.w}px`;
      slot.style.height = `${dim.h}px`;

      const inner = slot.firstElementChild as HTMLElement | null;
      if (inner) {
        fitCloneIntoSlot(inner, dim.w, dim.h);
      }
    });

    scheduleCachePng(wrapper);
    return true;
  };

  // Walk every merged group in the editor and flip its orientation to
  // match its current surrounding context (.vertical-run → horizontal,
  // otherwise → vertical). Called after any vertical-mode toggle so
  // existing groups stay perpendicular to the line.
  const relayoutAllMergedIcons = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const merged = editor.querySelectorAll<HTMLElement>(".svg-icon.merged");
    merged.forEach((m) => {
      // Skip nested merged groups (a merged inside another merged, if that
      // ever happens) — they get reflowed via their parent's layout.
      if (m.parentElement?.closest(".svg-icon.merged")) return;
      const horizontal = shouldMergedGroupBeHorizontal(m);
      const currentLayout = m.dataset.layout;
      if (
        (horizontal && currentLayout === "horizontal") ||
        (!horizontal && currentLayout === "vertical")
      ) {
        return;
      }
      relayoutMergedIcon(m, horizontal);
    });
  };

  const updateAllIconDimensionsForLayout = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll(".svg-icon").forEach((icon) => {
      const el = icon as HTMLElement;
      if (el.closest(".svg-icon.merged") && !el.classList.contains("merged"))
        return;
      applyIconDimensionsToElement(el);
    });
  };

  const updateAllIconTransforms = () => {
    // ... original implementation ...
    const editor = editorRef.current;
    if (!editor) return;

    const allIcons = editor.querySelectorAll(".svg-icon");

    allIcons.forEach((icon) => {
      const el = icon as HTMLElement;
      if (el.closest(".svg-icon.merged") && !el.classList.contains("merged"))
        return;
      if (el.closest(".cartouche-wrapper") && !el.dataset.cartouche) {
        return;
      }
      if (el.dataset.cartouche === "true") {
        const wasVertical = el.dataset.vertical === "true";
        const shouldBeVertical = columnMode;
        el.style.transform = composeIconTransform(el);

        if (wasVertical !== shouldBeVertical) {
          el.dataset.vertical = shouldBeVertical ? "true" : "false";

          const baseSize = Number(el.dataset.baseSize) || iconSize;
          const storedFitScale = Number(el.dataset.fitScale) || 0.86;

          const container = el.querySelector(
            ".cartouche-icons-container",
          ) as HTMLElement;

          let totalW = 0;
          let totalH = 0;
          let maxW = 0;
          let maxH = 0;

          if (container) {
            container.style.flexDirection = shouldBeVertical ? "column" : "row";
            container.style.writingMode = "horizontal-tb";

            const innerSvgs = container.querySelectorAll(":scope > svg");
            innerSvgs.forEach((svg) => {
              const svgEl = svg as SVGSVGElement;
              const ps = Number(svgEl.dataset.ps || "100") || 100;

              let arW = 100;
              let arH = 100;
              const vb = svgEl.getAttribute("viewBox");
              if (vb) {
                const p = vb.trim().split(/[\s,]+/);
                arW = parseFloat(p[2]) || 100;
                arH = parseFloat(p[3]) || 100;
              }

              const dims = getIconLayoutDimensions(
                ps,
                baseSize,
                arW,
                arH,
                shouldBeVertical,
              );

              svgEl.dataset.origW = String(dims.width);
              svgEl.dataset.origH = String(dims.height);
              svgEl.style.width = `${Math.round(dims.width * storedFitScale)}px`;
              svgEl.style.height = `${Math.round(dims.height * storedFitScale)}px`;

              totalW += dims.width;
              totalH += dims.height;
              maxW = Math.max(maxW, dims.width);
              maxH = Math.max(maxH, dims.height);
            });
          }

          const iconCount = container
            ? container.querySelectorAll(":scope > svg").length
            : 1;
          const gap = iconCount > 1 ? (iconCount - 1) * 2 : 0;

          // Mirror the cartouche outer-dim formula in `wrapInCartouche` so
          // that flipping vertical/horizontal preserves the same frame
          // padding around the glyphs.
          const refPerp = shouldBeVertical
            ? maxW || baseSize
            : maxH || baseSize;
          const PAD_LONG = Math.max(4, Math.round(refPerp * 0.18));
          const PAD_PERP = Math.max(2, Math.round(refPerp * 0.08));

          let newW: number;
          let newH: number;
          if (shouldBeVertical) {
            const innerW = maxW || baseSize;
            const innerH = Math.max(totalH + gap, innerW * 0.875);
            newW = innerW + 2 * PAD_PERP;
            newH = innerH + 2 * PAD_LONG;
          } else {
            const innerH = maxH || baseSize;
            const innerW = Math.max(totalW + gap, innerH * 0.875);
            newH = innerH + 2 * PAD_PERP;
            newW = innerW + 2 * PAD_LONG;
          }

          el.style.width = `${newW}px`;
          el.style.height = `${newH}px`;
          el.dataset.origWidth = String(newW);
          el.dataset.origHeight = String(newH);

          const oldSvg = el.querySelector(":scope > svg");
          if (oldSvg) oldSvg.remove();
          const newSvg = buildCartoucheSvg(
            newW,
            newH,
            shouldBeVertical,
            getCartoucheShape(el),
          );
          el.insertBefore(newSvg, el.firstChild);
        }
        return;
      } else {
        el.style.transform = composeIconTransform(el);
      }
    });
  };

  // Inline CSS applied to a `.vertical-run` wrapper. Using inline styles so
  // the vertical orientation survives serialization (saved HTML, copy/paste).
  const VERTICAL_RUN_CSS =
    "writing-mode: vertical-lr; text-orientation: upright; " +
    "display: inline-block; vertical-align: top; white-space: nowrap;";

  const findEnclosingVerticalRun = (
    node: Node | null,
    editor: HTMLElement,
  ): HTMLElement | null => {
    let current: Node | null = node;
    while (current && current !== editor) {
      if (
        current instanceof HTMLElement &&
        current.classList.contains("vertical-run")
      ) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };

  const unwrapElement = (el: HTMLElement) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  };

  const placeCaretAfter = (node: Node) => {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    savedRangeRef.current = range.cloneRange();
  };

  // Set the current selection to span all contents of `el` (inclusive of
  // the first child's start through the last child's end). Used after
  // wrap/unwrap so the toggle is reversible without re-selecting.
  const selectContentsOf = (el: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel) return;
    const first = el.firstChild;
    const last = el.lastChild;
    if (!first || !last) return;
    const newRange = document.createRange();
    newRange.setStartBefore(first);
    newRange.setEndAfter(last);
    sel.removeAllRanges();
    sel.addRange(newRange);
    savedRangeRef.current = newRange.cloneRange();
  };

  // Restore the selection to span the run of nodes from `from` (inclusive)
  // through `to` (inclusive), which must share the same parent. Used after
  // unwrapping a vertical-run so the previously-wrapped content stays
  // selected.
  const selectRangeOfSiblings = (from: Node, to: Node) => {
    const sel = window.getSelection();
    if (!sel) return;
    const newRange = document.createRange();
    newRange.setStartBefore(from);
    newRange.setEndAfter(to);
    sel.removeAllRanges();
    sel.addRange(newRange);
    savedRangeRef.current = newRange.cloneRange();
  };

  // Wrap the current selection in a `.vertical-run`. If the selection is
  // already entirely contained in a vertical-run, unwrap that run instead
  // (toggle off). The selection is preserved across the toggle so the
  // user can re-click the button to reverse the change.
  const toggleVerticalForSelection = (range: Range): boolean => {
    const editor = editorRef.current;
    if (!editor) return false;

    const enclosingStart = findEnclosingVerticalRun(
      range.startContainer,
      editor,
    );
    const enclosingEnd = findEnclosingVerticalRun(range.endContainer, editor);

    if (enclosingStart && enclosingStart === enclosingEnd) {
      const target = enclosingStart;
      const firstChild = target.firstChild;
      const lastChild = target.lastChild;
      unwrapElement(target);
      if (firstChild && lastChild) {
        selectRangeOfSiblings(firstChild, lastChild);
      }
      return true;
    }

    try {
      const fragment = range.extractContents();
      // Strip nested vertical-run wrappers from the fragment so we don't
      // produce nested vertical sections that flip orientation back.
      fragment
        .querySelectorAll<HTMLElement>("span.vertical-run")
        .forEach((nested) => unwrapElement(nested));

      if (!fragment.firstChild) return false;

      const wrapper = document.createElement("span");
      wrapper.className = "vertical-run";
      wrapper.setAttribute("style", VERTICAL_RUN_CSS);
      wrapper.appendChild(fragment);
      range.insertNode(wrapper);

      // Keep the wrapped content selected so the user can click Vertical
      // Mode again to undo, without having to re-select.
      selectContentsOf(wrapper);
      return true;
    } catch {
      return false;
    }
  };

  // Wrap every consecutive run of `.svg-icon` siblings in the editor with a
  // `.vertical-run.auto-hilo` span. Whitespace between icons is included so
  // the visual grouping is preserved. Returns the last wrapper created (if any)
  // so the caller can park the caret after it.
  const wrapAllHieroglyphRuns = (): HTMLElement | null => {
    const editor = editorRef.current;
    if (!editor) return null;

    let lastWrapper: HTMLElement | null = null;

    const wrapRunsIn = (parent: Element) => {
      const children = Array.from(parent.childNodes);
      let i = 0;
      while (i < children.length) {
        const child = children[i];
        if (
          child instanceof HTMLElement &&
          child.classList.contains("svg-icon") &&
          !child.closest(".vertical-run")
        ) {
          const runNodes: Node[] = [child];
          let j = i + 1;
          while (j < children.length) {
            const next = children[j];
            if (
              next instanceof HTMLElement &&
              next.classList.contains("svg-icon")
            ) {
              runNodes.push(next);
              j++;
              continue;
            }
            if (
              next.nodeType === Node.TEXT_NODE &&
              (next.textContent || "").trim() === ""
            ) {
              runNodes.push(next);
              j++;
              continue;
            }
            break;
          }

          const wrapper = document.createElement("span");
          wrapper.className = "vertical-run auto-hilo";
          wrapper.setAttribute("style", VERTICAL_RUN_CSS);
          parent.insertBefore(wrapper, child);
          runNodes.forEach((n) => wrapper.appendChild(n));
          lastWrapper = wrapper;
          i = j;
          continue;
        }

        if (
          child instanceof Element &&
          !child.classList.contains("svg-icon") &&
          !child.classList.contains("vertical-run")
        ) {
          wrapRunsIn(child);
        }
        i++;
      }
    };

    wrapRunsIn(editor);
    return lastWrapper;
  };

  const unwrapAllAutoHilo = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor
      .querySelectorAll<HTMLElement>("span.vertical-run.auto-hilo")
      .forEach((node) => unwrapElement(node));
  };

  const toggleColumnMode = () => {
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    const sel = window.getSelection();
    const hasSelection =
      !!editor &&
      !!sel &&
      sel.rangeCount > 0 &&
      !sel.getRangeAt(0).collapsed &&
      editor.contains(sel.getRangeAt(0).commonAncestorContainer);

    if (hasSelection && sel) {
      const range = sel.getRangeAt(0);
      const changed = toggleVerticalForSelection(range);
      if (changed) {
        // Merged groups inside the new (or removed) vertical-run need to
        // flip orientation so they stay perpendicular to the line.
        relayoutAllMergedIcons();
        resetTypingHistorySession();
        commitHistory("push");
      }
      editor?.focus();
      return;
    }

    const nextColumnMode = !columnMode;
    if (nextColumnMode) {
      const lastWrapper = wrapAllHieroglyphRuns();
      if (lastWrapper) placeCaretAfter(lastWrapper);
    } else {
      unwrapAllAutoHilo();
    }
    relayoutAllMergedIcons();
    setColumnMode(nextColumnMode);
    resetTypingHistorySession();
    commitHistory("push");
    editor?.focus();
  };

  useEffect(() => {
    updateAllIconTransforms();
    updateAllIconDimensionsForLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, columnMode]);

  // Global copy handler for click-selected icons (editor may not have focus)
  useEffect(() => {
    if (selectedIcons.length === 0) return;

    const handleGlobalCopy = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT")
      )
        return;

      const editor = editorRef.current;
      if (!editor) return;

      const sorted = [...selectedIcons].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      );
      const iconsHtml = sorted
        .map((icon) => {
          const clone = icon.cloneNode(true) as HTMLElement;
          clone.style.backgroundColor = "";
          return clone.outerHTML;
        })
        .join("");

      if (!iconsHtml) return;

      e.preventDefault();

      const clipboardHtml = buildCopyClipboardHtml(iconsHtml);
      e.clipboardData?.setData("text/html", clipboardHtml);
      e.clipboardData?.setData("text/plain", "");

      writeEnhancedClipboard(clipboardHtml, iconsHtml);
    };

    document.addEventListener("copy", handleGlobalCopy);
    return () => document.removeEventListener("copy", handleGlobalCopy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIcons]);

  // Resolve the set of top-level icons the next "selection-aware" command
  // (group, cartouche-wrap, rotate, ...) should operate on. Mirrors the
  // logic inside `mergeGroup`: prefer the explicit `selectedIcons` state
  // if non-empty, otherwise materialize whatever top-level glyphs the
  // current Range covers. Returned in document order.
  const collectSelectedTopLevelIcons = (): HTMLElement[] => {
    const editor = editorRef.current;
    if (!editor) return [];

    let collected: HTMLElement[] = [];
    if (selectedIcons.length >= 1) {
      collected = selectedIcons.filter(
        (n): n is HTMLElement => n instanceof HTMLElement,
      );
    } else {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return [];
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return [];

      // For a collapsed caret, also accept the icon directly under the
      // caret if the user clicked one (via selectedIcons it's already
      // covered, but we still want this branch for keyboard navigation).
      if (range.collapsed) return [];

      const fragment = range.cloneContents();
      const mergedGroups = Array.from(
        fragment.querySelectorAll(".svg-icon.merged"),
      );
      const standaloneIcons = Array.from(
        fragment.querySelectorAll(".svg-icon"),
      ).filter((n) => {
        const el = n as HTMLElement;
        if (el.classList.contains("merged")) return false;
        if (el.closest(".svg-icon.merged")) return false;
        return true;
      });
      const allInFragment = [...mergedGroups, ...standaloneIcons];
      collected = allInFragment
        .map((n) => {
          const id = (n as HTMLElement).dataset.id;
          if (!id) return null;
          return editor.querySelector(
            `.svg-icon[data-id="${id}"]`,
          ) as HTMLElement | null;
        })
        .filter((el): el is HTMLElement => !!el);
    }

    // De-dupe and sort in document order.
    const unique = Array.from(new Set(collected));
    unique.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    return unique;
  };

  // Apply `angle` (degrees) to every currently-selected top-level glyph.
  // Multi-selection rotates each glyph independently around its own
  // centre — matches the user's request: "as if he selected each one
  // then rotated".
  //
  // `commit` controls history: `false` while a dial drag is in progress
  // (preview only), `true` when the user releases / clicks a preset, so
  // the entire drag collapses into a single undo step.
  const rotateSelection = (
    angle: number,
    options?: { commit?: boolean },
  ) => {
    if (!editorCanEdit) return;
    const targets = collectSelectedTopLevelIcons();
    if (targets.length === 0) return;

    const normalized = normalizeAngle(angle);
    targets.forEach((el) => applyRotationToIcon(el, normalized));
    setSelectedIconRotation(normalized);

    if (options?.commit !== false) {
      resetTypingHistorySession();
      commitHistory("push");
    }
  };

  const mergeGroup = () => {
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    if (!editor) return;

    let iconsToMerge: Element[] = [];

    if (selectedIcons.length >= 2) {
      iconsToMerge = [...selectedIcons];
    } else {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;
      const fragment = range.cloneContents();

      const mergedGroups = Array.from(
        fragment.querySelectorAll(".svg-icon.merged"),
      );
      const standaloneIcons = Array.from(
        fragment.querySelectorAll(".svg-icon"),
      ).filter((n) => {
        const el = n as HTMLElement;
        if (el.classList.contains("merged")) return false;
        if (el.closest(".svg-icon.merged")) return false;
        return true;
      });
      const allInFragment = [...mergedGroups, ...standaloneIcons];
      if (allInFragment.length < 2) return;

      const realIcons: Element[] = allInFragment
        .map((n) => {
          const id = (n as HTMLElement).dataset.id;
          if (!id) return null;
          return editor.querySelector(
            `.svg-icon[data-id="${id}"]`,
          ) as Element | null;
        })
        .filter((el): el is Element => !!el);

      if (realIcons.length < 2) return;
      iconsToMerge = realIcons;
    }

    iconsToMerge.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );

    const mergedWrapper = createMergedIcon(iconsToMerge);
    if (!mergedWrapper) return;

    const first = iconsToMerge[0] as HTMLElement;
    first.parentNode?.insertBefore(mergedWrapper, first);
    iconsToMerge.forEach((ic) => (ic as HTMLElement).remove());

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.setStartAfter(mergedWrapper);
      newRange.collapse(true);
      sel.addRange(newRange);
    }
    scrollElementIntoView(mergedWrapper);
    setSelectedIcons([]);
    setSelectedIconCount(0);
    editor.focus();
    resetTypingHistorySession();
    commitHistory("push");
  };

  const openMagicBox = () => {
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    if (!editor) return;

    if (selectedIcons.length >= 2) {
      setShowMagicBox(true);
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    const fragment = range.cloneContents();

    const mergedGroups = Array.from(
      fragment.querySelectorAll(".svg-icon.merged"),
    );
    const standaloneIcons = Array.from(
      fragment.querySelectorAll(".svg-icon"),
    ).filter((n) => {
      const el = n as HTMLElement;
      if (el.classList.contains("merged")) return false;
      if (el.closest(".svg-icon.merged")) return false;
      return true;
    });
    const allInFragment = [...mergedGroups, ...standaloneIcons];
    if (allInFragment.length < 2) return;

    const realIcons: Element[] = allInFragment
      .map((n) => {
        const id = (n as HTMLElement).dataset.id;
        if (!id) return null;
        return editor.querySelector(
          `.svg-icon[data-id="${id}"]`,
        ) as Element | null;
      })
      .filter((el): el is Element => !!el);

    if (realIcons.length < 2) return;

    realIcons.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );

    setSelectedIcons(realIcons);
    setShowMagicBox(true);
  };

  const handleMagicBoxInsert = (
    compositeHtml: string,
    width: number,
    height: number,
  ) => {
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    if (!editor) return;

    const finalWidth = width;
    const finalHeight = height;

    const mergedWrapper = document.createElement("span");
    mergedWrapper.className = "svg-icon merged";
    mergedWrapper.contentEditable = "false";
    // See note in createMergedIcon: keep glyphs selectable like text.
    mergedWrapper.draggable = false;
    mergedWrapper.dataset.id = Math.random().toString(36).substr(2, 9);
    mergedWrapper.dataset.baseSize = String(Math.max(12, iconSize));
    mergedWrapper.dataset.magicbox = "true";
    mergedWrapper.dataset.magicboxCanonW = String(finalWidth);
    mergedWrapper.dataset.magicboxCanonH = String(finalHeight);
    if (columnMode) {
      mergedWrapper.dataset.magicboxColumn = "true";
    } else {
      delete mergedWrapper.dataset.magicboxColumn;
    }
    const maxComboW = Math.min(90, iconSize);
    const boxStyles = columnMode
      ? `
      width: ${finalWidth}px;
      max-width: ${maxComboW}px;
      max-height: 90px;
      height: ${finalHeight}px;
    `
      : `
      width: auto;
      max-width: ${maxComboW}px;
      max-height: none;
      height: ${finalHeight}px;
    `;
    mergedWrapper.style.cssText = `
      display: inline-block;
      cursor: text;
      margin: 4px 3px;
      vertical-align: middle;
      position: relative;
      ${boxStyles}
      transform: ${getSvgTransform()};
    `;
    mergedWrapper.innerHTML = `<div class="merged-inner-scale" style="position:relative;width:${finalWidth}px;height:${finalHeight}px;">${compositeHtml}</div>`;

    mergedWrapper.ondragstart = (e) => {
      e.stopPropagation();
      draggedElementRef.current = mergedWrapper;
      dragSourceRef.current = "editor";
      mergedWrapper.style.opacity = "0.5";
    };
    mergedWrapper.ondragend = () => {
      draggedElementRef.current = null;
      dragSourceRef.current = "";
      mergedWrapper.style.opacity = "1";
    };

    const sorted = [...selectedIcons].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );

    const first = sorted[0] as HTMLElement;
    first.parentNode?.insertBefore(mergedWrapper, first);
    sorted.forEach((ic) => (ic as HTMLElement).remove());

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const r = document.createRange();
      r.setStartAfter(mergedWrapper);
      r.collapse(true);
      sel.addRange(r);
    }

    scrollElementIntoView(mergedWrapper);
    scheduleCachePng(mergedWrapper);
    setShowMagicBox(false);
    setSelectedIcons([]);
    editor.focus();
    resetTypingHistorySession();
    commitHistory("push");
  };

  const wrapInCartouche = (shape: CartoucheShape = "oval") => {
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    if (!editor) return;

    let iconsToWrap: Element[] | null = null;

    if (selectedIcons.length >= 1) {
      iconsToWrap = selectedIcons.filter((icon) => {
        const el = icon as HTMLElement;
        if (el.classList.contains("merged")) return true;
        if (el.closest(".svg-icon.merged")) return false;
        return true;
      });
    } else {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const fragment = range.cloneContents();
      const icons = fragment.querySelectorAll(".svg-icon");
      if (icons.length < 1) return;

      const realIcons: Element[] = Array.from(icons)
        .map((n) => {
          const id = (n as HTMLElement).dataset.id;
          if (!id) return null;
          const el = editor.querySelector(`.svg-icon[data-id="${id}"]`);
          return el as Element | null;
        })
        .filter((el): el is Element => {
          if (!el) return false;
          const htmlEl = el as HTMLElement;
          if (htmlEl.classList.contains("merged")) return true;
          if (htmlEl.closest(".svg-icon.merged")) return false;
          return true;
        });
      if (realIcons.length < 1) return;

      iconsToWrap = realIcons;
    }

    if (!iconsToWrap || iconsToWrap.length === 0) return;

    iconsToWrap.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );

    const isVertical = columnMode;
    const fitScale = 0.86;

    let totalW = 0;
    let totalH = 0;
    let maxW = 0;
    let maxH = 0;
    iconsToWrap.forEach((icon) => {
      const el = icon as HTMLElement;
      const ps = Number(el.dataset.pictureSize || "100") || 100;
      const svg = el.querySelector("svg");
      let arW = 100;
      let arH = 100;
      if (svg) {
        const vb = svg.getAttribute("viewBox");
        if (vb) {
          const p = vb.trim().split(/[\s,]+/);
          arW = parseFloat(p[2]) || 100;
          arH = parseFloat(p[3]) || 100;
        }
      }
      const dims = getIconLayoutDimensions(ps, iconSize, arW, arH, isVertical);
      totalW += dims.width;
      totalH += dims.height;
      maxW = Math.max(maxW, dims.width);
      maxH = Math.max(maxH, dims.height);
    });

    const gap = iconsToWrap.length > 1 ? (iconsToWrap.length - 1) * 2 : 0;
    let cartoucheWidth: number;
    let cartoucheHeight: number;

    // Frame padding so that glyphs don't poke past the cartouche outline.
    // PAD_LONG accounts for the curved end at the long axis of the cartouche
    // (where the curve cuts in toward the glyphs). PAD_PERP is the smaller
    // padding from the flat side(s). Both are anchored to the *perpendicular*
    // content dimension so the padding scales with glyph size.
    const refPerp = isVertical ? maxW || iconSize : maxH || iconSize;
    const PAD_LONG = Math.max(4, Math.round(refPerp * 0.18));
    const PAD_PERP = Math.max(2, Math.round(refPerp * 0.08));

    if (isVertical) {
      const innerW = maxW || iconSize;
      const innerH = Math.max(totalH + gap, innerW * 0.875);
      cartoucheWidth = innerW + 2 * PAD_PERP;
      cartoucheHeight = innerH + 2 * PAD_LONG;
    } else {
      const innerH = maxH || iconSize;
      const innerW = Math.max(totalW + gap, innerH * 0.875);
      cartoucheHeight = innerH + 2 * PAD_PERP;
      cartoucheWidth = innerW + 2 * PAD_LONG;
    }

    const cartoucheWrapper = document.createElement("span");
    cartoucheWrapper.className = "svg-icon cartouche-wrapper";
    cartoucheWrapper.contentEditable = "false";
    // See note in createMergedIcon: keep glyphs selectable like text.
    cartoucheWrapper.draggable = false;
    cartoucheWrapper.dataset.id = Math.random().toString(36).substr(2, 9);
    cartoucheWrapper.dataset.cartouche = "true";
    cartoucheWrapper.dataset.cartoucheShape = shape;
    cartoucheWrapper.dataset.baseSize = String(iconSize);
    cartoucheWrapper.dataset.origWidth = String(cartoucheWidth);
    cartoucheWrapper.dataset.origHeight = String(cartoucheHeight);
    cartoucheWrapper.dataset.fitScale = String(fitScale);
    cartoucheWrapper.dataset.vertical = isVertical ? "true" : "false";

    const cartoucheTransform = direction === "rtl" ? "scaleX(-1)" : "none";

    cartoucheWrapper.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: text;
      vertical-align: middle;
      position: relative;
      margin: 4px 3px;
      width: ${cartoucheWidth}px;
      height: ${cartoucheHeight}px;
      box-sizing: border-box;
      overflow: hidden;
      transform: ${cartoucheTransform};
    `;

    const cartoucheSvg = buildCartoucheSvg(
      cartoucheWidth,
      cartoucheHeight,
      isVertical,
      shape,
    );

    const iconsContainer = document.createElement("span");
    iconsContainer.className = "cartouche-icons-container";
    iconsContainer.style.cssText = `
      display: flex;
      flex-direction: ${isVertical ? "column" : "row"};
      align-items: center;
      justify-content: center;
      gap: 3px;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
      pointer-events: none;
      writing-mode: horizontal-tb;
    `;

    iconsToWrap.forEach((icon) => {
      const iconEl = icon as HTMLElement;
      const ps = Number(iconEl.dataset.pictureSize || "100") || 100;
      const origSvg = iconEl.querySelector("svg");
      if (origSvg) {
        const clonedSvg = origSvg.cloneNode(true) as SVGSVGElement;

        let arW = 100;
        let arH = 100;
        const vb = clonedSvg.getAttribute("viewBox");
        if (vb) {
          const p = vb.trim().split(/[\s,]+/);
          arW = parseFloat(p[2]) || 100;
          arH = parseFloat(p[3]) || 100;
        }

        const dims = getIconLayoutDimensions(
          ps,
          iconSize,
          arW,
          arH,
          isVertical,
        );

        clonedSvg.dataset.origH = String(dims.height);
        clonedSvg.dataset.origW = String(dims.width);
        clonedSvg.dataset.ps = String(ps);
        clonedSvg.style.width = `${Math.round(dims.width * fitScale)}px`;
        clonedSvg.style.height = `${Math.round(dims.height * fitScale)}px`;
        clonedSvg.style.pointerEvents = "all";
        clonedSvg.style.cursor = "pointer";
        iconsContainer.appendChild(clonedSvg);
      } else if ((icon as HTMLElement).classList.contains("merged")) {
        const clonedIcon = icon.cloneNode(true) as HTMLElement;
        clonedIcon.style.cssText = `
          margin: 0;
          transform: scale(${fitScale});
          transform-origin: center center;
        `;
        iconsContainer.appendChild(clonedIcon);
      }
    });

    cartoucheWrapper.appendChild(cartoucheSvg);
    cartoucheWrapper.appendChild(iconsContainer);

    const firstIcon = iconsToWrap[0] as HTMLElement;
    firstIcon.parentNode?.insertBefore(cartoucheWrapper, firstIcon);
    iconsToWrap.forEach((icon) => icon.remove());

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.setStartAfter(cartoucheWrapper);
      newRange.collapse(true);
      sel.addRange(newRange);
    }

    scrollElementIntoView(cartoucheWrapper);
    scheduleCachePng(cartoucheWrapper);
    setSelectedIcons([]);
    editor.focus();
    resetTypingHistorySession();
    commitHistory("push");
  };

  const getEditorStyles = () => {
    // The editor root is always horizontal so plain text (e.g. English)
    // continues to flow normally. Vertical writing mode is opted-in per
    // selection or on hieroglyphic runs via the `.vertical-run` wrapper
    // (see toggleColumnMode).
    return {
      writingMode: "horizontal-tb" as const,
      textOrientation: "mixed" as const,
    };
  };

  const removeShading = () => {
    if (!editorCanEdit) return;

    if (!selectedSingleIcon) return;

    const iconEl = selectedSingleIcon as HTMLElement;
    const existingShading = iconEl.querySelector(".shading-overlay");
    if (existingShading) {
      existingShading.remove();
    }

    setSelectedIcons([]);
    setSelectedSingleIcon(null);
    setSelectedIconHasShading(false);
    resetTypingHistorySession();
    scheduleCachePng(iconEl);
    commitHistory("push");
  };

  // Helper function to get shading rectangles for a given pattern
  const getShadingRectsForPattern = (
    patternType: string,
  ): Array<{ x: number; y: number; width: number; height: number }> => {
    switch (patternType) {
      case "pattern-0": // None
        return [];
      case "pattern-1": // Top Left
        return [{ x: 0, y: 0, width: 50, height: 50 }];
      case "pattern-2": // Top Right
        return [{ x: 50, y: 0, width: 50, height: 50 }];
      case "pattern-3": // Top Half
        return [{ x: 0, y: 0, width: 100, height: 50 }];
      case "pattern-4": // Bottom Left
        return [{ x: 0, y: 50, width: 50, height: 50 }];
      case "pattern-5": // All Except Bottom Right
        return [
          { x: 0, y: 0, width: 50, height: 50 },
          { x: 50, y: 0, width: 50, height: 50 },
          { x: 0, y: 50, width: 50, height: 50 },
        ];
      case "pattern-6": // Bottom Right
        return [{ x: 50, y: 50, width: 50, height: 50 }];
      case "pattern-7": // Right Half
        return [{ x: 50, y: 0, width: 50, height: 100 }];
      case "pattern-8": // Top Left + Bottom Right
        return [
          { x: 0, y: 0, width: 50, height: 50 },
          { x: 50, y: 50, width: 50, height: 50 },
        ];
      case "pattern-9": // Top Right + Bottom Left
        return [
          { x: 50, y: 0, width: 50, height: 50 },
          { x: 0, y: 50, width: 50, height: 50 },
        ];
      case "pattern-A": // All Except Bottom Left
        return [
          { x: 0, y: 0, width: 50, height: 50 },
          { x: 50, y: 0, width: 50, height: 50 },
          { x: 50, y: 50, width: 50, height: 50 },
        ];
      case "pattern-B": // Bottom Half
        return [{ x: 0, y: 50, width: 100, height: 50 }];
      case "pattern-C": // All Except Top Left
        return [
          { x: 50, y: 0, width: 50, height: 50 },
          { x: 0, y: 50, width: 50, height: 50 },
          { x: 50, y: 50, width: 50, height: 50 },
        ];
      case "pattern-D": // All Except Top Right
        return [
          { x: 0, y: 0, width: 50, height: 50 },
          { x: 0, y: 50, width: 50, height: 50 },
          { x: 50, y: 50, width: 50, height: 50 },
        ];
      case "pattern-E": // Left Half
        return [{ x: 0, y: 0, width: 50, height: 100 }];
      case "pattern-F": // Full
        return [{ x: 0, y: 0, width: 100, height: 100 }];
      default:
        return [{ x: 0, y: 0, width: 100, height: 100 }];
    }
  };

  const insertFullShadingIcon = (patternType: string) => {
    if (!editorCanEdit) return;

    const editor = editorRef.current;
    if (!editor) return;

    resetTypingHistorySession();
    restoreSavedRangeIfNeeded();

    // Create wrapper for the shaded icon
    const wrapper = document.createElement("span");
    wrapper.className = "svg-icon";
    wrapper.contentEditable = "false";
    wrapper.draggable = false;
    wrapper.dataset.id = Math.random().toString(36).substr(2, 9);
    wrapper.style.cssText = `
      display: inline-block;
      cursor: text;
      margin: 0 2px;
      vertical-align: middle;
      transform: ${getSvgTransform()};
      position: relative;
    `;

    // Create the base SVG (empty rectangle)
    const baseSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    baseSvg.setAttribute("viewBox", "0 0 100 100");
    baseSvg.style.width = `${iconSize}px`;
    baseSvg.style.height = `${iconSize}px`;
    baseSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const baseRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    baseRect.setAttribute("width", "100");
    baseRect.setAttribute("height", "100");
    baseRect.setAttribute("fill", "none");
    baseRect.setAttribute("stroke", "#d1d5db");
    baseRect.setAttribute("stroke-width", "1");
    baseSvg.appendChild(baseRect);

    wrapper.appendChild(baseSvg);

    // Only create shading overlay if pattern is not pattern-0 (None)
    if (patternType !== "pattern-0") {
      const patternId = `shading-pattern-${wrapper.dataset.id}`;
      const shadingOverlay = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      shadingOverlay.classList.add("shading-overlay");
      shadingOverlay.setAttribute("viewBox", `0 0 ${iconSize} ${iconSize}`);
      shadingOverlay.setAttribute("preserveAspectRatio", "none");
      shadingOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      `;

      const defs = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "defs",
      );
      const pattern = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "pattern",
      );
      pattern.setAttribute("id", patternId);
      pattern.setAttribute("patternUnits", "userSpaceOnUse");
      pattern.setAttribute("width", "4");
      pattern.setAttribute("height", "4");

      const patternPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      patternPath.setAttribute("d", "M-1,3 l2,2 M0,0 l4,4 M3,-1 l2,2");
      patternPath.setAttribute("stroke", "#000");
      patternPath.setAttribute("stroke-width", "0.5");
      pattern.appendChild(patternPath);
      defs.appendChild(pattern);
      shadingOverlay.appendChild(defs);

      const shadingRects = getShadingRectsForPattern(patternType);
      const sz = iconSize;
      shadingRects.forEach((rectConfig) => {
        const overlayRect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        overlayRect.setAttribute("x", String((rectConfig.x * sz) / 100));
        overlayRect.setAttribute("y", String((rectConfig.y * sz) / 100));
        overlayRect.setAttribute(
          "width",
          String((rectConfig.width * sz) / 100),
        );
        overlayRect.setAttribute(
          "height",
          String((rectConfig.height * sz) / 100),
        );
        overlayRect.setAttribute("fill", `url(#${patternId})`);
        shadingOverlay.appendChild(overlayRect);
      });

      wrapper.appendChild(shadingOverlay);
    }

    // Add drag handlers
    wrapper.ondragstart = (e) => {
      e.stopPropagation();
      draggedElementRef.current = wrapper;
      dragSourceRef.current = "editor";
      wrapper.style.opacity = "0.5";
    };

    wrapper.ondragend = () => {
      draggedElementRef.current = null;
      dragSourceRef.current = "";
      wrapper.style.opacity = "1";
    };

    // Insert at cursor
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(wrapper);
        range.setStartAfter(wrapper);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRangeRef.current = range.cloneRange();
        scrollElementIntoView(wrapper);
      } else {
        editor.appendChild(wrapper);
        scrollElementIntoView(wrapper);
      }
    } else {
      editor.appendChild(wrapper);
      scrollElementIntoView(wrapper);
    }

    editor.focus();
    scheduleCachePng(wrapper);
    commitHistory("push");
  };

  const applyShading = (patternId: string) => {
    if (!editorCanEdit) return;

    if (!selectedSingleIcon) return;

    const iconEl = selectedSingleIcon as HTMLElement;
    const isMergedGroup = iconEl.classList.contains("merged");
    const svg = iconEl.querySelector("svg");
    if (!svg && !isMergedGroup) return;

    // Remove existing shading if any
    const existingShading = iconEl.querySelector(".shading-overlay");
    if (existingShading) {
      existingShading.remove();
    }

    // Use the wrapper's actual display dimensions for the overlay viewBox
    // so patterns and clip-paths work in CSS-pixel space at any icon size
    const wrapperRect = iconEl.getBoundingClientRect();
    const displayW = Math.round(wrapperRect.width) || iconSize;
    const displayH = Math.round(wrapperRect.height) || iconSize;
    const viewBox = `0 0 ${displayW} ${displayH}`;

    const shadingOverlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    shadingOverlay.classList.add("shading-overlay");
    shadingOverlay.setAttribute("viewBox", viewBox);
    shadingOverlay.setAttribute("preserveAspectRatio", "none");
    shadingOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    `;

    // Create clip-path definitions for geometric patterns
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    let clipPath: SVGClipPathElement | null = null;
    let clipPathId = "";

    switch (patternId) {
      case "pattern-0": {
        // No fill - don't create overlay
        setShowShadingOptions(false);
        return;
      }

      case "pattern-1": {
        // Top-left quadrant
        clipPathId = `shading-clip-${iconEl.dataset.id}-p1`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("x", "0");
        rect.setAttribute("y", "0");
        rect.setAttribute("width", "50%");
        rect.setAttribute("height", "50%");
        clipPath.appendChild(rect);
        break;
      }

      case "pattern-2": {
        // Top-right quadrant
        clipPathId = `shading-clip-${iconEl.dataset.id}-p2`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("x", "50%");
        rect.setAttribute("y", "0");
        rect.setAttribute("width", "50%");
        rect.setAttribute("height", "50%");
        clipPath.appendChild(rect);
        break;
      }

      case "pattern-3": {
        // Full top half
        clipPathId = `shading-clip-${iconEl.dataset.id}-p3`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("x", "0");
        rect.setAttribute("y", "0");
        rect.setAttribute("width", "100%");
        rect.setAttribute("height", "50%");
        clipPath.appendChild(rect);
        break;
      }

      case "pattern-4": {
        // Bottom-left quadrant
        clipPathId = `shading-clip-${iconEl.dataset.id}-p4`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("x", "0");
        rect.setAttribute("y", "50%");
        rect.setAttribute("width", "50%");
        rect.setAttribute("height", "50%");
        clipPath.appendChild(rect);
        break;
      }

      case "pattern-5": {
        // All except bottom-right quadrant (top-left, top-right, bottom-left)
        clipPathId = `shading-clip-${iconEl.dataset.id}-p5`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        // Create three rectangles for top-left, top-right, and bottom-left
        const rect1 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect1.setAttribute("x", "0");
        rect1.setAttribute("y", "0");
        rect1.setAttribute("width", "50%");
        rect1.setAttribute("height", "50%");
        const rect2 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect2.setAttribute("x", "50%");
        rect2.setAttribute("y", "0");
        rect2.setAttribute("width", "50%");
        rect2.setAttribute("height", "50%");
        const rect3 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect3.setAttribute("x", "0");
        rect3.setAttribute("y", "50%");
        rect3.setAttribute("width", "50%");
        rect3.setAttribute("height", "50%");
        clipPath.appendChild(rect1);
        clipPath.appendChild(rect2);
        clipPath.appendChild(rect3);
        break;
      }

      case "pattern-6": {
        // Bottom-right quadrant
        clipPathId = `shading-clip-${iconEl.dataset.id}-p6`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("x", "50%");
        rect.setAttribute("y", "50%");
        rect.setAttribute("width", "50%");
        rect.setAttribute("height", "50%");
        clipPath.appendChild(rect);
        break;
      }

      case "pattern-7": {
        // Right half (full height)
        clipPathId = `shading-clip-${iconEl.dataset.id}-p7`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("x", "50%");
        rect.setAttribute("y", "0");
        rect.setAttribute("width", "50%");
        rect.setAttribute("height", "100%");
        clipPath.appendChild(rect);
        break;
      }

      case "pattern-8": {
        // Top-left + Bottom-right quadrants (merge of pattern 1 and 6)
        clipPathId = `shading-clip-${iconEl.dataset.id}-p8`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        // Create two rectangles for top-left and bottom-right
        const rect1 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect1.setAttribute("x", "0");
        rect1.setAttribute("y", "0");
        rect1.setAttribute("width", "50%");
        rect1.setAttribute("height", "50%");
        const rect2 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect2.setAttribute("x", "50%");
        rect2.setAttribute("y", "50%");
        rect2.setAttribute("width", "50%");
        rect2.setAttribute("height", "50%");
        clipPath.appendChild(rect1);
        clipPath.appendChild(rect2);
        break;
      }

      case "pattern-9": {
        // Top-right + Bottom-left quadrants (merge of pattern 2 and 4)
        clipPathId = `shading-clip-${iconEl.dataset.id}-p9`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        // Create two rectangles for top-right and bottom-left
        const rect1 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect1.setAttribute("x", "50%");
        rect1.setAttribute("y", "0");
        rect1.setAttribute("width", "50%");
        rect1.setAttribute("height", "50%");
        const rect2 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect2.setAttribute("x", "0");
        rect2.setAttribute("y", "50%");
        rect2.setAttribute("width", "50%");
        rect2.setAttribute("height", "50%");
        clipPath.appendChild(rect1);
        clipPath.appendChild(rect2);
        break;
      }

      case "pattern-A": {
        // All except bottom-left quadrant (top-left, top-right, bottom-right)
        clipPathId = `shading-clip-${iconEl.dataset.id}-pA`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        // Create three rectangles for top-left, top-right, and bottom-right
        const rect1 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect1.setAttribute("x", "0");
        rect1.setAttribute("y", "0");
        rect1.setAttribute("width", "50%");
        rect1.setAttribute("height", "50%");
        const rect2 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect2.setAttribute("x", "50%");
        rect2.setAttribute("y", "0");
        rect2.setAttribute("width", "50%");
        rect2.setAttribute("height", "50%");
        const rect3 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect3.setAttribute("x", "50%");
        rect3.setAttribute("y", "50%");
        rect3.setAttribute("width", "50%");
        rect3.setAttribute("height", "50%");
        clipPath.appendChild(rect1);
        clipPath.appendChild(rect2);
        clipPath.appendChild(rect3);
        break;
      }

      case "pattern-B": {
        // Full bottom half
        clipPathId = `shading-clip-${iconEl.dataset.id}-pB`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("x", "0");
        rect.setAttribute("y", "50%");
        rect.setAttribute("width", "100%");
        rect.setAttribute("height", "50%");
        clipPath.appendChild(rect);
        break;
      }

      case "pattern-C": {
        // All except top-left quadrant (top-right, bottom-left, bottom-right)
        clipPathId = `shading-clip-${iconEl.dataset.id}-pC`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        // Create three rectangles for top-right, bottom-left, and bottom-right
        const rect1 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect1.setAttribute("x", "50%");
        rect1.setAttribute("y", "0");
        rect1.setAttribute("width", "50%");
        rect1.setAttribute("height", "50%");
        const rect2 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect2.setAttribute("x", "0");
        rect2.setAttribute("y", "50%");
        rect2.setAttribute("width", "50%");
        rect2.setAttribute("height", "50%");
        const rect3 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect3.setAttribute("x", "50%");
        rect3.setAttribute("y", "50%");
        rect3.setAttribute("width", "50%");
        rect3.setAttribute("height", "50%");
        clipPath.appendChild(rect1);
        clipPath.appendChild(rect2);
        clipPath.appendChild(rect3);
        break;
      }

      case "pattern-D": {
        // All except top-right quadrant (top-left, bottom-left, bottom-right)
        clipPathId = `shading-clip-${iconEl.dataset.id}-pD`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        // Create three rectangles for top-left, bottom-left, and bottom-right
        const rect1 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect1.setAttribute("x", "0");
        rect1.setAttribute("y", "0");
        rect1.setAttribute("width", "50%");
        rect1.setAttribute("height", "50%");
        const rect2 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect2.setAttribute("x", "0");
        rect2.setAttribute("y", "50%");
        rect2.setAttribute("width", "50%");
        rect2.setAttribute("height", "50%");
        const rect3 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect3.setAttribute("x", "50%");
        rect3.setAttribute("y", "50%");
        rect3.setAttribute("width", "50%");
        rect3.setAttribute("height", "50%");
        clipPath.appendChild(rect1);
        clipPath.appendChild(rect2);
        clipPath.appendChild(rect3);
        break;
      }

      case "pattern-E": {
        // Left half (full height)
        clipPathId = `shading-clip-${iconEl.dataset.id}-pE`;
        clipPath = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "clipPath",
        );
        clipPath.setAttribute("id", clipPathId);
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("x", "0");
        rect.setAttribute("y", "0");
        rect.setAttribute("width", "50%");
        rect.setAttribute("height", "100%");
        clipPath.appendChild(rect);
        break;
      }

      case "pattern-F": {
        // Full area shaded - no clip path needed
        break;
      }

      default: {
        // Unknown pattern
        console.warn("Unknown pattern:", patternId);
        setShowShadingOptions(false);
        return;
      }
    }

    // Create diagonal line pattern for all shadings
    const patternElemId = `shading-pattern-${iconEl.dataset.id}`;
    const patternElem = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "pattern",
    );
    patternElem.setAttribute("id", patternElemId);
    patternElem.setAttribute("patternUnits", "userSpaceOnUse");
    patternElem.setAttribute("width", "4");
    patternElem.setAttribute("height", "4");

    const patternPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    patternPath.setAttribute("d", "M-1,3 l2,2 M0,0 l4,4 M3,-1 l2,2");
    patternPath.setAttribute("stroke", "#000");
    patternPath.setAttribute("stroke-width", "0.5");
    patternElem.appendChild(patternPath);

    defs.appendChild(patternElem);

    // Add clip path to defs if we created one
    if (clipPath) {
      defs.appendChild(clipPath);
    }

    shadingOverlay.appendChild(defs);

    // Create the overlay rectangle with pattern fill and clip-path
    const overlayRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    overlayRect.setAttribute("width", "100%");
    overlayRect.setAttribute("height", "100%");
    overlayRect.setAttribute("fill", `url(#${patternElemId})`);

    if (clipPath) {
      overlayRect.setAttribute("clip-path", `url(#${clipPathId})`);
    }

    shadingOverlay.appendChild(overlayRect);

    // Make icon wrapper position relative if not already
    if (getComputedStyle(iconEl).position === "static") {
      iconEl.style.position = "relative";
    }

    // For merged groups: append overlay to cover entire group; for single icons: insert after SVG
    if (isMergedGroup) {
      iconEl.appendChild(shadingOverlay);
    } else {
      svg!.parentNode?.insertBefore(shadingOverlay, svg!.nextSibling);
    }

    // Close modal and clear selection
    setShowShadingOptions(false);
    setSelectedIcons([]);
    setSelectedSingleIcon(null);

    // Refocus editor
    editorRef.current?.focus();
    resetTypingHistorySession();
    scheduleCachePng(iconEl);
    commitHistory("push");
  };

  // --- Updated JSX Render ---

  // Show loading state while fetching document
  if (isLoadingDocument) {
    return (
      <CustomSection className="h-full overflow-visible mt-32">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#ccaa83] mb-4"></div>
            <p className="text-lg text-gray-600">Loading document...</p>
          </div>
        </div>
      </CustomSection>
    );
  }

  if (sharedAccessError) {
    return (
      <CustomSection className="h-full overflow-visible mt-32">
        <div className="mx-auto flex min-h-[360px] max-w-xl flex-col items-center justify-center rounded-md border border-[#D8A8659C] bg-[#FBF2E6] p-8 text-center">
          <h1 className="font-playfair-display text-2xl font-semibold text-gray-900">
            Shared File
          </h1>
          <p className="mt-3 font-poppins text-sm leading-relaxed text-gray-700">
            {sharedAccessError}
          </p>
          {sharedAccessError.toLowerCase().includes("pro") && (
            <button
              type="button"
              onClick={() => setShowSharedAccessPlansModal(true)}
              className="mt-5 rounded-md bg-[#A97C3C] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Upgrade to Pro
            </button>
          )}
        </div>
        <SubscriptionPlansModal
          open={showSharedAccessPlansModal}
          onOpenChange={setShowSharedAccessPlansModal}
          reason="save-limit"
        />
      </CustomSection>
    );
  }

  const editorLayout = (
    <div className="grid grid-rows-2 md:grid-rows-1 md:grid-cols-12 h-full gap-4">
      {/* 1. Left Sidebar */}
      <div
        className={`row-span-3 md:row-span-1 md:col-span-4 ${
          !editorCanEdit ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <Sidebar
          insertSvgAtCursor={insertSvgAtCursor}
          insertTextAtCursor={insertTextAtCursor}
          insertHtmlAtCursor={insertHtmlAtCursor}
          handlePaletteDragStart={handlePaletteDragStart}
          handlePaletteDragEnd={handlePaletteDragEnd}
          canEdit={editorCanEdit}
        />
      </div>
      <div className="row-span-1 md:row-span-1 md:col-span-8 border border-[#D8A8659C] rounded-md flex flex-col p-4 bg-[#FBF2E6]">
        {/* Editor Toolbar (Assistant Bar) */}
        <div className={!editorCanEdit ? "pointer-events-none opacity-50" : ""}>
          <Assistant
            handleTextCommand={handleTextCommand}
            setDirection={setDirection}
            direction={direction}
            toggleColumnMode={toggleColumnMode}
            mergeGroup={mergeGroup}
            selectedIconCount={selectedIconCount}
            textSize={textSize}
            setTextSize={handleTextSizeChange}
            onImageSelected={insertImageAtCursor}
            iconSize={iconSize}
            setIconSize={handleIconSizeChange}
            onShadingClick={() => setShowShadingOptions(true)}
            onRemoveShadingClick={removeShading}
            showShadingButton={!!selectedSingleIcon}
            iconHasShading={selectedIconHasShading}
            onInsertFullShading={insertFullShadingIcon}
            onCartoucheWrap={wrapInCartouche}
            onMagicBox={openMagicBox}
            iconVerticalAlign={iconVerticalAlignDefault}
            onIconVerticalAlign={applyIconVerticalAlign}
            selectedIconRotation={selectedIconRotation}
            onRotateSelection={rotateSelection}
          />
        </div>

        {isEditMode && (lockMessage || isAcquiringLock) && (
          <div
            className={`mb-3 rounded-md border px-4 py-3 text-sm font-poppins flex items-center justify-between ${
              editorCanEdit
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : isAcquiringLock
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <span>{lockMessage || "Connecting to editing session..."}</span>
            {!editorCanEdit && lockMessage?.toLowerCase().includes("locked") && (
              <button
                onClick={handleRetryLock}
                className="ml-3 px-3 py-1 text-xs font-medium rounded bg-amber-200 text-amber-900 hover:bg-amber-300 transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* The Editor Area (same as before) */}
        <div
          ref={editorRef}
          contentEditable={editorCanEdit}
          aria-readonly={!editorCanEdit}
          suppressContentEditableWarning
          onMouseDown={handleEditorMouseDown}
          onMouseMove={handleEditorMouseMove}
          onMouseUp={handleEditorMouseUp}
          onClick={handleEditorClick}
          onKeyDown={handleEditorKeyDown}
          onBeforeInput={handleEditorBeforeInput}
          onInput={handleEditorInput}
          onDrop={handleEditorDrop}
          onDragOver={handleEditorDragOver}
          onCopy={handleEditorCopy}
          onCut={handleEditorCut}
          onPaste={handleEditorPaste}
          className={`
            editor-content
            min-h-[400px] w-full 
            border-2 border-[#D8A86585]
            rounded-b-md p-0 
            text-base leading-relaxed outline-none 
            bg-[#FFF] overflow-auto flex-grow
            box-border
          `}
          style={{
            fontFamily: "Arial, sans-serif",
            whiteSpace: "pre-wrap",
            ...getEditorStyles(),
          }}
        ></div>

        {/* Editor Actions - Save and Export buttons */}
        <EditorActions
          editorRef={editorRef}
          isEditMode={isEditMode}
          editingDocId={editingDocId}
          initialDocumentTitle={editingDocument?.title || ""}
          isFullScreen={isFullScreen}
          onToggleFullScreen={toggleFullScreen}
          canEdit={editorCanEdit}
          readOnlyReason={readOnlyReason}
          lockSessionId={lockSessionIdRef.current}
          shareToken={shareToken}
          canManageSharing={!isEditMode || editingDocument?.is_owner !== false}
          onDocumentSaved={handleDocumentSaved}
        />

        {/* Shading Patterns Modal */}
        {showShadingOptions && (
          <ShadingPatterns
            onSelectPattern={applyShading}
            onClose={() => setShowShadingOptions(false)}
          />
        )}

        {/* Merge Options Modal removed — Group now handles any count directly */}
      </div>
    </div>
  );

  const magicBoxModal = showMagicBox && selectedIcons.length >= 2 && (
    <MagicBox
      icons={selectedIcons}
      iconSize={iconSize}
      columnMode={columnMode}
      onClose={() => setShowMagicBox(false)}
      onInsert={handleMagicBoxInsert}
    />
  );

  return (
    <div
      className={
        isFullScreen
          ? "fixed inset-0 z-50 bg-[#F6E9D8] p-4 overflow-hidden"
          : ""
      }
    >
      <CustomSection
        className={
          isFullScreen
            ? "h-full overflow-hidden mt-0 !max-w-none !w-full !mx-0 !px-0 !my-0"
            : "h-full overflow-visible mt-32"
        }
      >
        {editorLayout}
      </CustomSection>
      {magicBoxModal}
    </div>
  );
}
