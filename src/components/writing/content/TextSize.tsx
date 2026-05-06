import { textSizes } from "@/data";
import { Type } from "lucide-react";

const TextSize = ({
  textSize,
  setTextSize,
}: {
  textSize: number;
  setTextSize: (textSize: number) => void;
}) => {
  return (
    <div className="flex items-center gap-2">
      <Type className="w-4 h-4 text-[#6b7280]" />
      <select
        data-keep-selection
        value={textSize}
        onChange={(e) => setTextSize(Number(e.target.value))}
        className="rounded text-center p-1"
      >
        {!textSizes.includes(textSize) && (
          <option value={textSize} hidden>
            {textSize}
          </option>
        )}
        {textSizes.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TextSize;
