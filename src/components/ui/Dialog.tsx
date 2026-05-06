import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

interface DialogContentProps {
  children: ReactNode;
  className?: string;
}

interface DialogHeaderProps {
  children: ReactNode;
}

interface DialogTitleProps {
  children: ReactNode;
}

interface DialogDescriptionProps {
  children: ReactNode;
}

interface DialogFooterProps {
  children: ReactNode;
}

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/50 z-50"
          />
          {/*
            Center in a flex layer instead of translate on the motion panel.
            Framer Motion sets inline `transform` for scale/y, which overrides
            Tailwind's -translate-x/y-1/2 and leaves the dialog pinned to
            left:50% top:50% (appears shifted down on large modals).
          */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-none overscroll-none">
            <div className="flex w-full max-h-full min-h-0 justify-center items-center overscroll-none">
              {children}
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export const DialogContent = ({
  children,
  className = "",
}: DialogContentProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.2 }}
      className={`relative z-50 w-full max-w-lg max-h-full min-h-0 bg-white rounded-lg shadow-lg pointer-events-auto ${className}`}
    >
      {children}
    </motion.div>
  );
};

export const DialogHeader = ({ children }: DialogHeaderProps) => {
  return <div className="flex flex-col space-y-1.5 p-6 pb-4">{children}</div>;
};

export const DialogTitle = ({ children }: DialogTitleProps) => {
  return (
    <h2 className="text-xl font-semibold text-gray-900 font-playfair-display">
      {children}
    </h2>
  );
};

export const DialogDescription = ({ children }: DialogDescriptionProps) => {
  return <p className="text-sm text-gray-600 font-poppins">{children}</p>;
};

export const DialogFooter = ({ children }: DialogFooterProps) => {
  return (
    <div className="flex items-center justify-end gap-3 p-6 pt-4">
      {children}
    </div>
  );
};

export const DialogClose = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
    >
      <X className="h-4 w-4" />
    </button>
  );
};
