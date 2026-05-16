/* --------------------------------------------------------------------------
 *  Tiny popover primitive.
 *
 *  Wraps a trigger + a panel, handles click-outside and Escape to
 *  close, and gets out of the way otherwise. There's deliberately no
 *  positioning library: the panel is absolutely positioned beneath
 *  the trigger via plain CSS, which is enough for the toolbar's
 *  needs.
 *
 *  Focus model: the panel does NOT prevent default on mousedown, so
 *  inputs inside it can be focused. The editor's selection survives
 *  focus loss because ProseMirror keeps the doc selection state even
 *  when the editor view is blurred.
 * ------------------------------------------------------------------------ */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./Popover.css";

interface IProps {
  /** Render-prop for the trigger. The host owns the trigger so it
   *  can pass through ToolbarButton styling, active state, etc. */
  trigger: (api: { open: boolean; toggle: () => void; close: () => void }) => ReactNode;
  /** Panel contents. Receives `close` so any inner control can
   *  programmatically dismiss the popover after acting. */
  children: (api: { close: () => void }) => ReactNode;
  /** Where the panel should align relative to the trigger.
   *  Defaults to "left" (panel's left edge under trigger's left). */
  align?: "left" | "right";
  className?: string;
}

export const Popover = ({
  trigger,
  children,
  align = "left",
  className,
}: IProps) => {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!hostRef.current) return;
      if (!hostRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div
      ref={hostRef}
      className={`popover-host ${className ?? ""}`.trim()}
    >
      {trigger({ open, toggle, close })}
      {open && (
        <div
          className={`popover-panel popover-panel--${align}`}
          role="dialog"
        >
          {children({ close })}
        </div>
      )}
    </div>
  );
};
