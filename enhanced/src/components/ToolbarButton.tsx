/* --------------------------------------------------------------------------
 *  Shared toolbar button. Visual style is the same as the legacy
 *  editor — brown idle / lighter brown active — so the prototype reads
 *  as the same product family.
 * ------------------------------------------------------------------------ */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./ToolbarButton.css";

interface IProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

export const ToolbarButton = ({
  active = false,
  disabled = false,
  className,
  children,
  ...rest
}: IProps) => {
  // Suppress mousedown focus-steal so the editor selection stays
  // intact when the user clicks a toolbar button.
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      className={[
        "tb-btn",
        active ? "tb-btn--active" : "",
        disabled ? "tb-btn--disabled" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
};
