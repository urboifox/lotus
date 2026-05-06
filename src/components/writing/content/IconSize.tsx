import React from "react";
import { Minus, Plus } from "lucide-react";
import G5Icon from "@/assets/G5.svg?react";

const IconSize = ({
  iconSize,
  setIconSize,
}: {
  iconSize: number;
  setIconSize: (iconSize: number) => void;
}) => {
  const [inputValue, setInputValue] = React.useState(String(iconSize));

  React.useEffect(() => {
    setInputValue(String(iconSize));
  }, [iconSize]);

  const increase = () => {
    if (iconSize >= 90) return;
    setIconSize(iconSize + 1);
  };

  const decrease = () => {
    if (iconSize <= 12) return;
    setIconSize(iconSize - 1);
  };

  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const raw = e.target.value;
    setInputValue(raw);
    if (raw.trim() === "") return;
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    if (next < 12 || next > 90) return;
    setIconSize(next);
  };

  const onInputBlur = () => {
    const next = Number(inputValue);
    if (!Number.isFinite(next)) {
      setInputValue(String(iconSize));
      return;
    }
    const clamped = Math.min(90, Math.max(12, next));
    setIconSize(clamped);
    setInputValue(String(clamped));
  };

  return (
    <div className="flex items-center gap-2">
      <G5Icon className="w-4 h-4 g5-icon text-[#6b7280]" />
      <Minus className="cursor-pointer w-4 h-4" onClick={decrease} />
      <input
        data-keep-selection
        type="number"
        min={12}
        max={90}
        step={1}
        value={inputValue}
        onChange={onInputChange}
        onBlur={onInputBlur}
        className="w-14 rounded text-center p-1"
      />
      <Plus className="cursor-pointer w-4 h-4" onClick={increase} />
    </div>
  );
};

export default IconSize;
