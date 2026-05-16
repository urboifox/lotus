/* --------------------------------------------------------------------------
 *  Cartouche popover.
 *
 *  Trigger button is "Cartouche" with active state when the current
 *  selection is wrapped in any known variant. The popover shows one
 *  tile per variant (rendered through HieroJax for a faithful
 *  preview); clicking a tile toggles or switches that variant.
 *
 *  The popover is also where we'd add new variants in the future —
 *  add a row to `CARTOUCHE_VARIANTS` in editor/commands.ts and it
 *  shows up here automatically.
 * ------------------------------------------------------------------------ */

import { useEffect, useRef } from "react";
import { Popover } from "./Popover";
import { ToolbarButton } from "./ToolbarButton";
import { whenReady } from "../editor/hierojax";
import {
  CARTOUCHE_VARIANTS,
  type CartoucheVariant,
} from "../editor/commands";
import "./CartouchePopover.css";

interface IProps {
  /** What variant currently wraps the selection, if any. */
  currentVariant: CartoucheVariant | null;
  /** Caller-provided runner — same RangeCommand pipeline as the
   *  rest of the toolbar so transactions stay consistent. */
  applyVariant: (variant: CartoucheVariant) => void;
  disabled: boolean;
}

const VariantTile = ({
  variant,
  active,
  onClick,
}: {
  variant: CartoucheVariant;
  active: boolean;
  onClick: () => void;
}) => {
  const sampleRef = useRef<HTMLSpanElement>(null);

  // Ask HieroJax to render the sample once the host span is mounted
  // and the library is ready.
  useEffect(() => {
    let cancelled = false;
    whenReady()
      .then(() => {
        if (cancelled || !sampleRef.current) return;
        window.hierojax?.processFragment(sampleRef.current);
      })
      .catch(() => {
        /* timeout already logged by whenReady */
      });
    return () => {
      cancelled = true;
    };
  }, [variant.sample]);

  return (
    <button
      type="button"
      className={[
        "cartouche-popover__tile",
        active ? "cartouche-popover__tile--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      title={variant.label}
    >
      <span ref={sampleRef} className="hierojax cartouche-popover__sample">
        {variant.sample}
      </span>
      <span className="cartouche-popover__name">{variant.label}</span>
    </button>
  );
};

export const CartouchePopover = ({
  currentVariant,
  applyVariant,
  disabled,
}: IProps) => {
  const triggerLabel = currentVariant
    ? `Cartouche · ${currentVariant.label.split(" ")[0]}`
    : "Cartouche";

  return (
    <Popover
      trigger={({ open, toggle }) => (
        <ToolbarButton
          active={!disabled && currentVariant != null}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Wrap selection in a cartouche"
          onClick={toggle}
        >
          {triggerLabel}
        </ToolbarButton>
      )}
    >
      {({ close }) => (
        <div className="cartouche-popover">
          <div className="cartouche-popover__label">Cartouche style</div>
          <div className="cartouche-popover__grid">
            {CARTOUCHE_VARIANTS.map((v) => (
              <VariantTile
                key={v.id}
                variant={v}
                active={currentVariant?.id === v.id}
                onClick={() => {
                  applyVariant(v);
                  close();
                }}
              />
            ))}
          </div>
          <p className="cartouche-popover__hint">
            Click again to remove. Switching styles re-wraps the selection.
          </p>
        </div>
      )}
    </Popover>
  );
};
