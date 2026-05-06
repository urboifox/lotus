import { useEffect, useState } from "react";

export function InlineSvg({
  fileName,
  onLoad,
  onError,
  size = 50,
}: {
  fileName: string;
  onLoad?: (svg: string) => void;
  onError?: () => void;
  size?: number;
}) {
  const [svgContent, setSvgContent] = useState<string | null>(null);

  const sanitizeSvg = (raw: string) => {
    if (!raw.includes("<svg")) return null;

    // Extract the opening <svg ...> tag
    const openTagMatch = raw.match(/<svg[^>]*>/i);
    if (!openTagMatch) return null;

    const openTag = openTagMatch[0];

    // Capture potential width/height numeric values before stripping
    const widthMatch = openTag.match(/\bwidth\s*=\s*"?(\d+(?:\.\d+)?)"?/i);
    const heightMatch = openTag.match(/\bheight\s*=\s*"?(\d+(?:\.\d+)?)"?/i);

    // Remove existing width/height attributes
    let cleanedTag = openTag
      .replace(/\swidth\s*=\s*"[^"]*"/gi, "")
      .replace(/\sheight\s*=\s*"[^"]*"/gi, "");

    // Ensure viewBox exists
    const hasViewBox = /\bviewBox\s*=\s*"[^"]*"/i.test(cleanedTag);
    if (!hasViewBox) {
      const w = widthMatch ? Number(widthMatch[1]) : 100;
      const h = heightMatch ? Number(heightMatch[1]) : 100;
      cleanedTag = cleanedTag.replace(
        /<svg/i,
        `<svg viewBox="0 0 ${Number.isFinite(w) ? w : 100} ${
          Number.isFinite(h) ? h : 100
        }"`,
      );
    }

    // Add controlled width/height to fill container
    cleanedTag = cleanedTag.replace(
      /<svg(.*)>/i,
      '<svg$1 width="100%" height="100%">',
    );

    // Rebuild SVG with sanitized opening tag
    const sanitized = raw.replace(openTag, cleanedTag);
    return sanitized;
  };

  useEffect(() => {
    if (fileName.trim().startsWith("<svg")) {
      const sanitized = sanitizeSvg(fileName);
      if (sanitized) {
        setSvgContent(sanitized);
        if (onLoad) onLoad(sanitized);
      } else {
        setSvgContent(null);
      }
      return;
    }

    const dotSvgIdx = fileName.toLowerCase().indexOf(".svg");
    const capped =
      dotSvgIdx >= 0
        ? fileName.slice(0, dotSvgIdx).toUpperCase() + fileName.slice(dotSvgIdx)
        : fileName.toUpperCase();
    const url = `https://hodyhnyawooejrkdpzhz.supabase.co/storage/v1/object/public/Loutas_svg/${capped}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("SVG not found");
        return res.text();
      })
      .then((svg) => {
        const sanitized = sanitizeSvg(svg);
        if (sanitized) {
          setSvgContent(sanitized);
          if (onLoad) onLoad(sanitized);
        } else {
          setSvgContent(null);
          onError?.();
        }
      })
      .catch(() => {
        setSvgContent(null);
        onError?.();
      });
  }, [fileName, onLoad, onError]);

  if (!svgContent) return null;

  return (
    <div
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
