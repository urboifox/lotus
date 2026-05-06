import React, { useCallback, useEffect, useRef, useState } from "react";
import { Document, ImageRun, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { SubscriptionPlansModal } from "@/components/payment/SubscriptionPlansModal";
import { useSaveDocument, useUpdateDocument } from "@/services/docs";
import { useCurrentPlan } from "@/services/payment";
import type { CurrentPlan } from "@/types/payment";
import {
  getStoredExportCount,
  getUserEmailFromStorage,
  incrementStoredExportCount,
  clearStoredExportCount,
} from "@/utils/exportUsage";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Share2 } from "lucide-react";
import ShareModal from "./ShareModal";
import { showToast } from "@/components/ui/Toast";

interface EditorActionsProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  isEditMode: boolean;
  editingDocId: string;
  initialDocumentTitle?: string;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  canEdit?: boolean;
  readOnlyReason?: string;
  lockSessionId?: string;
  shareToken?: string;
  canManageSharing?: boolean;
  onDocumentSaved?: (doc: { id: string; title: string }) => void;
}

export default function EditorActions({
  editorRef,
  isEditMode,
  editingDocId,
  initialDocumentTitle = "",
  isFullScreen,
  onToggleFullScreen,
  canEdit = true,
  readOnlyReason,
  lockSessionId,
  shareToken,
  canManageSharing = true,
  onDocumentSaved,
}: EditorActionsProps) {
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [documentTitle, setDocumentTitle] = useState(initialDocumentTitle);
  const [isExporting, setIsExporting] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [plansModalReason, setPlansModalReason] = useState<
    "export-limit" | "save-limit"
  >("export-limit");
  const [localExportUsed, setLocalExportUsed] = useState(0);
  const [pendingSaveAndShare, setPendingSaveAndShare] = useState(false);
  const [savedDocIdForShare, setSavedDocIdForShare] = useState<string | null>(null);
  const [showSaveFirstPrompt, setShowSaveFirstPrompt] = useState(false);

  const { data: currentPlanRaw, isLoading: currentPlanLoading } =
    useCurrentPlan(true);
  const currentPlan = currentPlanRaw as CurrentPlan | undefined;

  /** First load with no cached plan — wait before enforcing limits or showing upgrade modal. */
  const planFetchPending = currentPlanLoading && !currentPlan;

  // `/CurrentPlan` doesn't return `exports_used` in your example.
  // We track usage locally as a fallback, but we must reset that fallback
  // after a successful upgrade (so the user doesn't get "upgrade" again).
  const prevRemoteLimitRef = useRef<number | null>(null);
  const prevRemoteWatermarkRef = useRef<boolean | null>(null);

  // React Query mutations for saving and updating document
  const saveDocumentMutation = useSaveDocument();
  const updateDocumentMutation = useUpdateDocument();

  useEffect(() => {
    setLocalExportUsed(getStoredExportCount(getUserEmailFromStorage()));
  }, []);

  useEffect(() => {
    if (!currentPlan) return;
    const email = getUserEmailFromStorage();
    const newLimit = currentPlan.export_limit;
    const prevLimit = prevRemoteLimitRef.current;

    // Only reset when remote limit increases (free -> paid, or after renewal).
    if (prevLimit !== null && newLimit > prevLimit && newLimit > 0) {
      clearStoredExportCount(email);
      setLocalExportUsed(0);
    }

    prevRemoteLimitRef.current = newLimit;
  }, [currentPlan?.export_limit, currentPlan]);

  useEffect(() => {
    if (!currentPlan) return;
    const email = getUserEmailFromStorage();
    const newWatermark = currentPlan.watermark;
    const prevWatermark = prevRemoteWatermarkRef.current;

    // Free plan has `watermark: true`, paid has `watermark: false`.
    if (prevWatermark === true && newWatermark === false) {
      clearStoredExportCount(email);
      setLocalExportUsed(0);
    }

    prevRemoteWatermarkRef.current = newWatermark;
  }, [currentPlan?.watermark, currentPlan]);

  const canPerformExport = useCallback((): boolean => {
    // Wait for first plan payload so limits are correct (avoid export spam before fetch).
    if (currentPlanLoading && !currentPlan) return false;

    // Fetch finished but no plan (error / empty): enforce like free tier (1 export) via local count.
    if (!currentPlan) {
      return localExportUsed < 1;
    }

    const limit = currentPlan.export_limit;
    // `export_limit: 0` means no exports allowed for this plan on the backend.
    if (!limit || limit <= 0) return false;

    // Backend often sends `exports_used: 0` as a default even when it does not track usage.
    // If we trusted only that field, free users would never hit the limit. Combine with local.
    const remoteUsed = currentPlan.exports_used ?? 0;
    const used = Math.max(localExportUsed, remoteUsed);
    return used < limit;
  }, [currentPlan, currentPlanLoading, localExportUsed]);

  const trackExportIfNeeded = useCallback(() => {
    incrementStoredExportCount(getUserEmailFromStorage());
    setLocalExportUsed(getStoredExportCount(getUserEmailFromStorage()));
  }, []);

  // Helper to yield to browser for smooth scrolling during export
  const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

  // Update document title when initialDocumentTitle changes
  useEffect(() => {
    setDocumentTitle(initialDocumentTitle);
  }, [initialDocumentTitle]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportDropdown) {
        const target = event.target as Element;
        if (!target.closest(".export-dropdown-container")) {
          setShowExportDropdown(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportDropdown]);

  const exportAsPNG = async () => {
    if (!editorRef.current) {
      alert("No content to export");
      return;
    }

    setIsExporting(true);
    await yieldToBrowser();

    try {
      const editor = editorRef.current;

      // Create a clean container with only the content (no container styling)
      const contentWrapper = document.createElement("div");
      contentWrapper.innerHTML = editor.innerHTML;

      // Apply minimal styling - only what's needed for proper rendering
      contentWrapper.style.cssText = `
        position: fixed;
        left: -99999px;
        top: 0;
        z-index: -99999;
        pointer-events: none;
        display: inline-block;
        white-space: nowrap;
        background-color: transparent;
        padding: 0;
        margin: 0;
        border: none;
        font-family: Arial, sans-serif;
        font-size: ${editor.style.fontSize || "18px"};
        direction: ${editor.style.direction || "ltr"};
        writing-mode: ${editor.style.writingMode || "horizontal-tb"};
      `;

      // Append to body temporarily
      document.body.appendChild(contentWrapper);

      // Wait for layout to settle
      await new Promise((resolve) => setTimeout(resolve, 150));
      await yieldToBrowser();

      // Get the actual content dimensions (tight fit)
      const contentWidth = contentWrapper.scrollWidth;
      const contentHeight = contentWrapper.scrollHeight;

      // Create canvas with very high quality settings for sharp export
      const canvas = await html2canvas(contentWrapper, {
        backgroundColor: "#FFFFFF",
        scale: 6, // Higher scale for sharper SVGs (6x resolution)
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 0,
        foreignObjectRendering: false,
        width: contentWidth,
        height: contentHeight,
        windowWidth: contentWidth,
        windowHeight: contentHeight,
        scrollY: 0,
        scrollX: 0,
      });

      await yieldToBrowser();

      // Remove wrapper from DOM
      document.body.removeChild(contentWrapper);

      // Convert to high-quality PNG
      const link = document.createElement("a");
      link.download = "hieroglyphic-content.png";
      link.href = canvas.toDataURL("image/png", 1.0);
      link.click();
      trackExportIfNeeded();
    } catch (error) {
      console.error("Error exporting as PNG:", error);
      alert("Failed to export as PNG. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!editorRef.current) {
      alert("No content to export");
      return;
    }

    setIsExporting(true);
    await yieldToBrowser();

    try {
      const editor = editorRef.current;

      const contentWrapper = document.createElement("div");
      contentWrapper.innerHTML = editor.innerHTML;

      contentWrapper.style.cssText = `
        position: fixed;
        left: -99999px;
        top: 0;
        z-index: -99999;
        pointer-events: none;
        display: inline-block;
        white-space: nowrap;
        background-color: transparent;
        padding: 0;
        margin: 0;
        border: none;
        font-family: Arial, sans-serif;
        font-size: ${editor.style.fontSize || "18px"};
        direction: ${editor.style.direction || "ltr"};
        writing-mode: ${editor.style.writingMode || "horizontal-tb"};
      `;

      document.body.appendChild(contentWrapper);

      await new Promise((resolve) => setTimeout(resolve, 150));
      await yieldToBrowser();

      const contentWidth = contentWrapper.scrollWidth;
      const contentHeight = contentWrapper.scrollHeight;

      const canvas = await html2canvas(contentWrapper, {
        backgroundColor: "#FFFFFF",
        scale: 6,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 0,
        foreignObjectRendering: false,
        width: contentWidth,
        height: contentHeight,
        windowWidth: contentWidth,
        windowHeight: contentHeight,
        scrollY: 0,
        scrollX: 0,
      });

      await yieldToBrowser();

      document.body.removeChild(contentWrapper);

      const imgData = canvas.toDataURL("image/png", 1.0);

      const pxToMm = 25.4 / 96;
      const margin = 5;
      const pdfWidth = contentWidth * pxToMm + margin * 2;
      const pdfHeight = contentHeight * pxToMm + margin * 2;

      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
        unit: "mm",
        format: [pdfWidth, pdfHeight],
        compress: false,
      });

      pdf.addImage(
        imgData,
        "PNG",
        margin,
        margin,
        contentWidth * pxToMm,
        contentHeight * pxToMm,
      );

      pdf.save("hieroglyphic-content.pdf");
      trackExportIfNeeded();
    } catch (error) {
      console.error("Error exporting as PDF:", error);
      alert("Failed to export as PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsDOCX = async () => {
    if (!editorRef.current) {
      alert("No content to export");
      return;
    }

    setIsExporting(true);
    await yieldToBrowser();

    let contentWrapper: HTMLDivElement | null = null;
    try {
      const editor = editorRef.current;

      type RunStyle = {
        bold?: boolean;
        italics?: boolean;
        underline?: boolean;
        size?: number;
      };

      const docxImageRenderScale = 3;

      const pxToHalfPoints = (px: number) =>
        Math.max(2, Math.round((px * 72 * 2) / 96));

      const parsePx = (value: string | null | undefined): number | undefined => {
        if (!value) return undefined;
        const parsed = Number.parseFloat(value.replace("px", ""));
        return Number.isFinite(parsed) ? parsed : undefined;
      };

      const getElementSize = (el: Element, fallback = 32) => {
        const rect = el.getBoundingClientRect();
        const width =
          Math.round(rect.width) ||
          parsePx((el as HTMLElement).style?.width) ||
          parsePx(el.getAttribute("width")) ||
          fallback;
        const height =
          Math.round(rect.height) ||
          parsePx((el as HTMLElement).style?.height) ||
          parsePx(el.getAttribute("height")) ||
          fallback;
        return {
          width: Math.max(1, Math.round(width)),
          height: Math.max(1, Math.round(height)),
        };
      };

      const toUint8ArrayFromDataUrl = async (dataUrl: string) => {
        const response = await fetch(dataUrl);
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
      };

      const getDocxImageTypeFromDataUrl = (dataUrl: string) => {
        const lower = dataUrl.toLowerCase();
        if (
          lower.startsWith("data:image/jpeg") ||
          lower.startsWith("data:image/jpg")
        ) {
          return "jpg" as const;
        }
        if (lower.startsWith("data:image/gif")) {
          return "gif" as const;
        }
        if (lower.startsWith("data:image/bmp")) {
          return "bmp" as const;
        }
        return "png" as const;
      };

      const svgToPngBytes = async (
        svgElement: SVGSVGElement,
        width: number,
        height: number,
        scale = 1,
      ) => {
        const renderWidth = Math.max(1, Math.round(width * scale));
        const renderHeight = Math.max(1, Math.round(height * scale));
        const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
        svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svgClone.setAttribute("width", String(renderWidth));
        svgClone.setAttribute("height", String(renderHeight));
        if (!svgClone.getAttribute("viewBox")) {
          svgClone.setAttribute("viewBox", `0 0 ${width} ${height}`);
        }

        const serialized = new XMLSerializer().serializeToString(svgClone);
        const svgBlob = new Blob([serialized], {
          type: "image/svg+xml;charset=utf-8",
        });
        const blobUrl = URL.createObjectURL(svgBlob);

        try {
          const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () =>
              reject(new Error("Failed to render SVG for Word export."));
            img.src = blobUrl;
          });

          const canvas = document.createElement("canvas");
          canvas.width = renderWidth;
          canvas.height = renderHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Failed to create canvas context for SVG conversion.");
          }
          ctx.drawImage(image, 0, 0, renderWidth, renderHeight);

          const pngBlob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
          });

          if (!pngBlob) {
            throw new Error("Failed to convert SVG to PNG for Word export.");
          }

          return new Uint8Array(await pngBlob.arrayBuffer());
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      };

      const elementToPngBytes = async (
        element: HTMLElement,
        width: number,
        height: number,
        scale = 1,
      ) => {
        const renderWidth = Math.max(1, Math.round(width));
        const renderHeight = Math.max(1, Math.round(height));
        const canvas = await html2canvas(element, {
          backgroundColor: null,
          scale,
          useCORS: true,
          allowTaint: true,
          logging: false,
          imageTimeout: 0,
          foreignObjectRendering: false,
          width: renderWidth,
          height: renderHeight,
          windowWidth: renderWidth,
          windowHeight: renderHeight,
          scrollX: 0,
          scrollY: 0,
        });

        const pngBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
        });

        if (!pngBlob) {
          throw new Error("Failed to convert element to PNG for Word export.");
        }

        return new Uint8Array(await pngBlob.arrayBuffer());
      };

      const getChildRuns = async (
        parent: Node,
        style: RunStyle,
      ): Promise<Array<TextRun | ImageRun>> => {
        const runs: Array<TextRun | ImageRun> = [];
        for (const child of Array.from(parent.childNodes)) {
          runs.push(...(await nodeToRuns(child, style)));
        }
        return runs;
      };

      const nodeToRuns = async (
        node: Node,
        style: RunStyle,
      ): Promise<Array<TextRun | ImageRun>> => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = (node.textContent ?? "").replace(/\u00A0/g, " ");
          if (!text) return [];

          return [
            new TextRun({
              text,
              bold: style.bold,
              italics: style.italics,
              underline: style.underline ? {} : undefined,
              size: style.size,
            }),
          ];
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
          return [];
        }

        const element = node as HTMLElement;
        const tag = element.tagName.toLowerCase();

        if (tag === "br") {
          return [new TextRun({ text: "", break: 1 })];
        }

        if (tag === "img") {
          const imageElement = element as HTMLImageElement;
          const src = imageElement.getAttribute("src") ?? "";
          if (!src) return [];
          const bytes = await toUint8ArrayFromDataUrl(src);
          const { width, height } = getElementSize(imageElement, 24);
          return [
            new ImageRun({
              data: bytes,
              type: getDocxImageTypeFromDataUrl(src),
              transformation: { width, height },
            }),
          ];
        }

        if (element.classList.contains("svg-icon")) {
          const { width, height } = getElementSize(element, 24);
          const bytes = await elementToPngBytes(
            element,
            width,
            height,
            docxImageRenderScale,
          );
          return [
            new ImageRun({
              data: bytes,
              type: "png",
              transformation: { width, height },
            }),
          ];
        }

        if (tag === "svg") {
          const svgElement = element as unknown as SVGSVGElement;
          const { width, height } = getElementSize(svgElement, 24);
          const bytes = await svgToPngBytes(
            svgElement,
            width,
            height,
            docxImageRenderScale,
          );
          return [
            new ImageRun({
              data: bytes,
              type: "png",
              transformation: { width, height },
            }),
          ];
        }

        const nextStyle: RunStyle = { ...style };
        if (tag === "b" || tag === "strong") nextStyle.bold = true;
        if (tag === "i" || tag === "em") nextStyle.italics = true;
        if (tag === "u") nextStyle.underline = true;
        if (element.style.fontWeight === "bold") nextStyle.bold = true;
        if (Number.parseInt(element.style.fontWeight, 10) >= 600) {
          nextStyle.bold = true;
        }
        if (element.style.fontStyle === "italic") nextStyle.italics = true;
        if (element.style.textDecoration.includes("underline")) {
          nextStyle.underline = true;
        }
        const fontSize = parsePx(element.style.fontSize);
        if (fontSize) nextStyle.size = pxToHalfPoints(fontSize);

        return getChildRuns(element, nextStyle);
      };

      contentWrapper = document.createElement("div");
      contentWrapper.innerHTML = editor.innerHTML;
      contentWrapper.style.cssText = `
        position: fixed;
        left: -99999px;
        top: 0;
        z-index: -99999;
        pointer-events: none;
        display: inline-block;
        background-color: #FFFFFF;
        padding: 0;
        margin: 0;
        border: none;
        font-family: Arial, sans-serif;
        font-size: ${editor.style.fontSize || "18px"};
        direction: ${editor.style.direction || "ltr"};
        writing-mode: ${editor.style.writingMode || "horizontal-tb"};
      `;
      document.body.appendChild(contentWrapper);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const defaultSize = pxToHalfPoints(parsePx(editor.style.fontSize) || 18);
      const baseStyle: RunStyle = { size: defaultSize };
      const paragraphs: Paragraph[] = [];
      let currentRootRuns: Array<TextRun | ImageRun> = [];

      for (const node of Array.from(contentWrapper.childNodes)) {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          ["div", "p"].includes((node as HTMLElement).tagName.toLowerCase())
        ) {
          if (currentRootRuns.length > 0) {
            paragraphs.push(new Paragraph({ children: currentRootRuns }));
            currentRootRuns = [];
          }

          const runs = await getChildRuns(node, baseStyle);
          paragraphs.push(
            new Paragraph({
              children: runs.length > 0 ? runs : [new TextRun({ text: "" })],
            }),
          );
          continue;
        }

        if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as HTMLElement).tagName.toLowerCase() === "br"
        ) {
          paragraphs.push(
            new Paragraph({
              children:
                currentRootRuns.length > 0
                  ? currentRootRuns
                  : [new TextRun({ text: "" })],
            }),
          );
          currentRootRuns = [];
          continue;
        }

        currentRootRuns.push(...(await nodeToRuns(node, baseStyle)));
      }

      if (currentRootRuns.length > 0) {
        paragraphs.push(new Paragraph({ children: currentRootRuns }));
      }

      if (paragraphs.length === 0) {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
      }

      const doc = new Document({
        sections: [
          {
            children: paragraphs,
          },
        ],
      });

      const docBlob = await Packer.toBlob(doc);
      saveAs(docBlob, "hieroglyphic-content.docx");
      trackExportIfNeeded();
    } catch (error) {
      console.error("Error exporting as Word:", error);
      alert("Failed to export as Word. Please try again.");
    } finally {
      if (contentWrapper && contentWrapper.parentNode) {
        contentWrapper.parentNode.removeChild(contentWrapper);
      }
      setIsExporting(false);
    }
  };

  // const exportAsSVG = () => {
  //   if (!editorRef.current) {
  //     alert("No content to export");
  //     return;
  //   }

  //   try {
  //     const editor = editorRef.current;

  //     // Create a clean container with only the content
  //     const contentWrapper = document.createElement("div");
  //     contentWrapper.innerHTML = editor.innerHTML;
  //     contentWrapper.style.cssText = `
  //       display: inline-block;
  //       white-space: nowrap;
  //       font-family: Arial, sans-serif;
  //       font-size: ${editor.style.fontSize || "18px"};
  //       direction: ${editor.style.direction || "ltr"};
  //       writing-mode: ${editor.style.writingMode || "horizontal-tb"};
  //     `;

  //     // Temporarily add to DOM to measure
  //     contentWrapper.style.position = "fixed";
  //     contentWrapper.style.left = "-99999px";
  //     document.body.appendChild(contentWrapper);

  //     const contentWidth = contentWrapper.scrollWidth;
  //     const contentHeight = contentWrapper.scrollHeight;

  //     document.body.removeChild(contentWrapper);

  //     // Reset position style for SVG export
  //     contentWrapper.style.position = "";
  //     contentWrapper.style.left = "";

  //     // Create SVG wrapper
  //     const svgNS = "http://www.w3.org/2000/svg";
  //     const svg = document.createElementNS(svgNS, "svg");
  //     svg.setAttribute("xmlns", svgNS);
  //     svg.setAttribute("width", String(contentWidth));
  //     svg.setAttribute("height", String(contentHeight));
  //     svg.setAttribute("viewBox", `0 0 ${contentWidth} ${contentHeight}`);

  //     // Add white background
  //     const bgRect = document.createElementNS(svgNS, "rect");
  //     bgRect.setAttribute("width", "100%");
  //     bgRect.setAttribute("height", "100%");
  //     bgRect.setAttribute("fill", "white");
  //     svg.appendChild(bgRect);

  //     // Use foreignObject to embed the HTML content
  //     const foreignObject = document.createElementNS(svgNS, "foreignObject");
  //     foreignObject.setAttribute("width", String(contentWidth));
  //     foreignObject.setAttribute("height", String(contentHeight));
  //     foreignObject.setAttribute("x", "0");
  //     foreignObject.setAttribute("y", "0");

  //     // Clone content and set proper namespace
  //     const htmlContent = document.createElement("div");
  //     htmlContent.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  //     htmlContent.innerHTML = editor.innerHTML;
  //     htmlContent.style.cssText = `
  //       display: inline-block;
  //       white-space: nowrap;
  //       font-family: Arial, sans-serif;
  //       font-size: ${editor.style.fontSize || "18px"};
  //       direction: ${editor.style.direction || "ltr"};
  //       writing-mode: ${editor.style.writingMode || "horizontal-tb"};
  //     `;

  //     foreignObject.appendChild(htmlContent);
  //     svg.appendChild(foreignObject);

  //     // Serialize to string
  //     const serializer = new XMLSerializer();
  //     const svgString = serializer.serializeToString(svg);

  //     // Create blob and download
  //     const blob = new Blob([svgString], {
  //       type: "image/svg+xml;charset=utf-8",
  //     });
  //     const url = URL.createObjectURL(blob);

  //     const link = document.createElement("a");
  //     link.download = "hieroglyphic-content.svg";
  //     link.href = url;
  //     link.click();

  //     URL.revokeObjectURL(url);
  //   } catch (error) {
  //     console.error("Error exporting as SVG:", error);
  //     alert("Failed to export as SVG. Please try again.");
  //   }
  // };

  const handleSave = () => {
    if (!canEdit) {
      showToast(readOnlyReason || "Editing is currently locked for this file.", "error");
      return;
    }

    if (!editorRef.current) {
      showToast("No content to save.", "error");
      return;
    }

    setShowSaveModal(true);
  };

  const handleSaveConfirm = () => {
    if (!editorRef.current) {
      return;
    }

    // Use default title if empty
    const title = documentTitle.trim() || "Untitled Document";

    // Get the HTML content (innerHTML only, not the wrapper div)
    const htmlContent = editorRef.current.innerHTML;

    if (isEditMode && editingDocId) {
      // Update existing document
      updateDocumentMutation.mutate(
        {
          id: editingDocId,
          documentData: {
            title: title,
            html: htmlContent,
          },
          lockSessionId,
          shareToken,
        },
          {
            onSuccess: () => {
              showToast("File saved successfully.", "success");
              setShowSaveModal(false);
            },
            onError: (error) => {
              console.error("Error updating document:", error);
              showToast("Could not save file. Please try again.", "error");
            },
          },
        );
    } else {
      // Create new document
      saveDocumentMutation.mutate(
        {
          title: title,
          html: htmlContent,
        },
        {
          onSuccess: (data) => {
            setShowSaveModal(false);
            showToast("File saved successfully.", "success");
            if (data?.id) {
              onDocumentSaved?.({ id: data.id, title });
            }
            if (pendingSaveAndShare) {
              setPendingSaveAndShare(false);
              if (data?.id) {
                setSavedDocIdForShare(data.id);
                setShowShareModal(true);
              }
            }
          },
          onError: (error) => {
            console.error("Error saving content:", error);
            setPendingSaveAndShare(false);
            const msg = error instanceof Error ? error.message : String(error);
            if (
              msg.toLowerCase().includes("docs limit") ||
              msg.toLowerCase().includes("docs_limit_reached") ||
              msg.toLowerCase().includes("limit reached")
            ) {
              setShowSaveModal(false);
              setPlansModalReason("save-limit");
              setShowPlansModal(true);
              return;
            }
            showToast("Could not save file. Please try again.", "error");
          },
        },
      );
    }
  };

  const effectiveShareDocId = savedDocIdForShare || editingDocId;

  const handleShare = () => {
    if (!effectiveShareDocId) {
      setShowSaveFirstPrompt(true);
      return;
    }
    setShowShareModal(true);
  };

  const handleSaveAndShare = () => {
    setShowSaveFirstPrompt(false);
    setPendingSaveAndShare(true);
    setShowSaveModal(true);
  };

  const handleSaveCancel = () => {
    setShowSaveModal(false);
    setDocumentTitle(initialDocumentTitle);
  };

  const handleExportClick = () => {
    setShowExportDropdown(!showExportDropdown);
  };

  const handleExportOption = (option: "png" | "pdf" | "svg" | "docx") => {
    // Close dropdown immediately
    setShowExportDropdown(false);

    if (planFetchPending) {
      return;
    }

      if (!canPerformExport()) {
        setPlansModalReason("export-limit");
        setShowPlansModal(true);
        return;
      }

    // Execute export after a small delay to ensure dropdown closes
    setTimeout(async () => {
      try {
        switch (option) {
          case "png":
            await exportAsPNG();
            break;
          case "pdf":
            await exportAsPDF();
            break;
          case "docx":
            await exportAsDOCX();
            break;
          // case "svg":
          //   exportAsSVG();
          //   break;
        }
      } catch (error) {
        console.error("Export failed:", error);
        alert(
          `Failed to export as ${option.toUpperCase()}. Check console for details.`,
        );
      }
    }, 100);
  };

  return (
    <>
      {/* Export Loading Overlay */}
      {isExporting && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: "24px 32px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                border: "3px solid #e5e7eb",
                borderTopColor: "#ccaa83",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <span style={{ fontSize: 16, fontWeight: 500, color: "#374151" }}>
              Exporting...
            </span>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        className={`
          flex justify-end 
          mt-4
          border-t-0 
          rounded-b-lg 
          gap-3
          relative
        `}
        style={{ overflow: "visible" }}
      >
        <button
          onClick={onToggleFullScreen}
          className={`
            px-5 py-2.5 
            bg-[#ccaa83] 
            text-white 
            border-0 
            rounded 
            cursor-pointer 
            font-medium 
          `}
        >
          {isFullScreen ? "Exit Full Screen" : "Full Screen"}
        </button>
        <button
          onClick={handleSave}
          disabled={!canEdit}
          className={`
            px-5 py-2.5 
            bg-[#ccaa83] 
            text-white 
            border-0 
            rounded 
            font-medium 
            ${canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-60"} 
          `}
        >
          {isEditMode ? "Update" : "Save"}
        </button>
        {!shareToken && canManageSharing && (
          <button
            onClick={handleShare}
            className={`
              px-5 py-2.5
              bg-[#ccaa83]
              text-white
              border-0
              rounded
              cursor-pointer
              font-medium
              inline-flex items-center gap-2
            `}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        )}
        <div className="relative export-dropdown-container">
          <button
            type="button"
            title={planFetchPending ? "Loading your plan…" : undefined}
            disabled={planFetchPending || isExporting}
            onClick={handleExportClick}
            className={`
              px-5 py-2.5 
              bg-[#ccaa83] 
              text-white 
              border-0 
              rounded 
              font-medium 
              flex items-center gap-2
              ${planFetchPending || isExporting ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {planFetchPending ? "Export…" : "Export"}
            <svg
              className={`w-4 h-4 transition-transform ${
                showExportDropdown ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showExportDropdown && (
            <div
              className={`absolute right-0 w-48 bg-white rounded-md shadow-lg border border-gray-200 ${
                isFullScreen ? "bottom-full mb-2" : "mt-2"
              }`}
              style={{ zIndex: 10000 }}
            >
              <div className="py-1">
                <button
                  onClick={() => handleExportOption("png")}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <svg
                    className="w-4 h-4 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Export as PNG
                </button>
                <button
                  onClick={() => handleExportOption("pdf")}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <svg
                    className="w-4 h-4 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  Export as PDF
                </button>
                <button
                  onClick={() => handleExportOption("docx")}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <svg
                    className="w-4 h-4 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  Export as Word
                </button>
                {/* <button
                  onClick={() => handleExportOption("svg")}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <svg
                    className="w-4 h-4 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                  Export as SVG (Vector)
                </button> */}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Document Modal */}
      {showSaveModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={handleSaveCancel}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 32,
              maxWidth: 500,
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 24,
                fontSize: 24,
                fontWeight: "bold",
              }}
            >
              {isEditMode ? "Update Document" : "Save Document"}
            </h3>

            <div style={{ marginBottom: 24 }}>
              <Label htmlFor="document-title">Document Title</Label>
              <Input
                id="document-title"
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Enter document title"
                autoFocus
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={handleSaveCancel}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  backgroundColor: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfirm}
                disabled={
                  saveDocumentMutation.isPending ||
                  updateDocumentMutation.isPending
                }
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  backgroundColor: "#ccaa83",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  cursor:
                    saveDocumentMutation.isPending ||
                    updateDocumentMutation.isPending
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: 500,
                  opacity:
                    saveDocumentMutation.isPending ||
                    updateDocumentMutation.isPending
                      ? 0.6
                      : 1,
                }}
              >
                {isEditMode
                  ? updateDocumentMutation.isPending
                    ? "Updating..."
                    : "Update"
                  : saveDocumentMutation.isPending
                    ? "Saving..."
                    : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

        <SubscriptionPlansModal
          open={showPlansModal}
          onOpenChange={setShowPlansModal}
          reason={plansModalReason}
        />
        <ShareModal
          open={showShareModal}
          onOpenChange={(open) => {
            setShowShareModal(open);
            if (!open) setSavedDocIdForShare(null);
          }}
          documentId={effectiveShareDocId}
          documentTitle={documentTitle || initialDocumentTitle}
        />

        {/* Save First Prompt */}
        {showSaveFirstPrompt && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowSaveFirstPrompt(false)}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 32,
                maxWidth: 420,
                width: "90%",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 20, fontWeight: "bold" }}>
                Save before sharing
              </h3>
              <p style={{ marginBottom: 24, color: "#4b5563", fontSize: 14 }}>
                Save this file before sharing it?
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setShowSaveFirstPrompt(false)}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    backgroundColor: "#e5e7eb",
                    color: "#374151",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAndShare}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    backgroundColor: "#ccaa83",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Save and Share
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
