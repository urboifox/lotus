import { GetGardnerByName, GetGardnerBytranslation } from "@/services/svg";
import type { GardnerItem } from "@/interfaces";
import React, { useState } from "react";
import { XIcon } from "lucide-react";
import Search from "./Search";
import FamilySelect from "./FamilySelect";
import PaletteItem from "./PalleteLoader";

interface SidebarProps {
  insertSvgAtCursor: (svgString: string, pictureSize?: number) => void;
  insertTextAtCursor?: (text: string) => void;
  insertHtmlAtCursor?: (html: string) => void;
  handlePaletteDragStart: (svgString: string, e: React.DragEvent) => void;
  handlePaletteDragEnd: (e: React.DragEvent) => void;
  canEdit?: boolean;
}

const buildFallbackSvg = (label: string, index: number) => {
  const hue = (index * 45) % 360;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="12" fill="hsl(${hue}, 65%, 85%)" />
      <circle cx="50" cy="44" r="18" fill="hsl(${hue}, 65%, 55%)" />
      <text x="50" y="78" text-anchor="middle" font-size="20" font-family="Arial" fill="#3a2a1a">
        ${label.toUpperCase()}
      </text>
    </svg>
  `;
};

const buildFallbackGlyphs = (family: string): GardnerItem[] => {
  const familyLabel = family || "f";
  return Array.from({ length: 12 }).map((_, index) => ({
    id: `${familyLabel}-${index + 1}`,
    family: familyLabel,
    gardner_code: `${familyLabel.toUpperCase()}${index + 1}`,
    picture_URL: buildFallbackSvg(familyLabel, index),
    picture_size: 100,
    gardner_details: [],
  }));
};

export default function Sidebar({
  // svgs,
  // Removed: direction, columnMode, setDirection, toggleColumnMode
  insertSvgAtCursor,
  insertTextAtCursor,
  insertHtmlAtCursor,
  handlePaletteDragStart,
  handlePaletteDragEnd,
  canEdit = true,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("b");
  const [selected, setSelected] = useState<{
    id: string | number;
    rawSvg: string;
  } | null>(null);

  // Use search results when search is active, otherwise use family results
  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
  } = GetGardnerBytranslation({
    language: "ar",
    search_term: search,
  });
  const {
    data: familyData,
    isLoading: familyLoading,
    error: familyError,
  } = GetGardnerByName(family);

  // Determine which data to use based on search state
  const isSearchActive = search.trim() !== "";
  const data = isSearchActive ? searchData : familyData;
  const isLoading = isSearchActive ? searchLoading : familyLoading;
  const error = isSearchActive ? searchError : familyError;
  const resolvedData = Array.isArray(data) ? data : [];
  const hasInvalidData =
    !isLoading && data !== undefined && !Array.isArray(data);
  const hasError = Boolean(error) || hasInvalidData;
  const fallbackGlyphs = buildFallbackGlyphs(family);
  const displayData =
    !isSearchActive && hasError ? fallbackGlyphs : resolvedData;

  const selectedItem = React.useMemo(() => {
    if (!selected || displayData.length === 0) return null;
    const match = displayData.find(
      (item: GardnerItem) => String(item.id) === String(selected.id),
    );
    return match || null;
  }, [selected, displayData]);

  // Group translations by latin word with meanings array
  const latinEnglishPairs = React.useMemo(() => {
    if (!selectedItem?.gardner_details)
      return [] as Array<{ latin: string; meanings: string[] }>;

    // Group meanings by latin word - include all latin words even without translations
    const grouped = new Map<string, Set<string>>();

    selectedItem.gardner_details.forEach(
      (detail: GardnerItem["gardner_details"][number]) => {
        const latin = detail.transliteration_latin?.trim();
        if (!latin) return;

        // Always initialize the latin word in the map
        if (!grouped.has(latin)) {
          grouped.set(latin, new Set<string>());
        }

        // Add English translation if it exists
        const enTranslation = detail.translations
          ?.find(
            (t) =>
              t.language === "en" &&
              typeof t.translation === "string" &&
              t.translation.trim().length > 0,
          )
          ?.translation.trim();

        if (enTranslation) {
          grouped.get(latin)!.add(enTranslation);
        }
      },
    );

    // Convert to array of objects with latin and meanings array
    const pairs: Array<{ latin: string; meanings: string[] }> = [];
    grouped.forEach((meanings, latin) => {
      const meaningsArray = Array.from(meanings);
      pairs.push({ latin, meanings: meaningsArray });
    });

    // Sort alphabetically by the latin word (case-insensitive)
    return pairs.sort((a, b) =>
      a.latin.localeCompare(b.latin, undefined, { sensitivity: "base" }),
    );
  }, [selectedItem]);

  return (
    <div className="row-span-3 md:row-span-1 md:col-span-4 bg-[#FBF2E6] border border-[#D8A8659C] rounded-md p-4 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2 font-playfair-display">
          Search By
        </h3>
        <Search search={search} setSearch={setSearch} />
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2 font-playfair-display">
          Select Hieroglyphic Family
        </h3>
        <FamilySelect setFamily={setFamily} />
      </div>

      <div
        className={`grid grid-cols-6 gap-2 items-start content-start justify-center bg-[#FFF] p-2 rounded-md max-h-[300px] ${
          isLoading || (hasError && displayData.length === 0)
            ? "overflow-hidden"
            : "overflow-y-auto overflow-x-hidden"
        }`}
      >
        {isLoading ? (
          <>
            {Array.from({ length: 30 }).map((_, index) => (
              <div
                key={index}
                className="w-full h-12 bg-[#FAE5C8] rounded-md animate-pulse"
              />
            ))}
          </>
        ) : hasError && displayData.length === 0 ? (
          <div className="col-span-6 flex items-center justify-center h-[300px] text-gray-500 overflow-hidden">
            <div className="text-center">
              <p className="text-lg font-medium">No results found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          </div>
        ) : displayData.length > 0 ? (
          displayData.map(({ picture_URL, id, picture_size }: GardnerItem) => (
            <PaletteItem
              key={id}
              id={id}
              picture_URL={picture_URL}
              pictureSize={picture_size}
              insertSvgAtCursor={insertSvgAtCursor}
              handlePaletteDragStart={handlePaletteDragStart}
              handlePaletteDragEnd={handlePaletteDragEnd}
              canEdit={canEdit}
              onSelect={(pid, rawSvg) => setSelected({ id: pid, rawSvg })}
            />
          ))
        ) : (
          <div className="col-span-6 flex items-center justify-center h-[300px] text-gray-500 overflow-hidden">
            <div className="text-center">
              <p className="text-lg font-medium">No results found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          </div>
        )}
      </div>

      {selected && selectedItem && (
        <div className="mt-4 bg-white border border-[#D8A8659C] rounded-md p-4">
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 flex items-center justify-center">
              {selected.rawSvg ? (
                <div
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{ __html: selected.rawSvg }}
                />
              ) : (
                <span className="text-xs text-gray-400 text-center px-1">
                  Photo not found
                </span>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-base mb-2 font-playfair-display ">
                Details
              </h4>
              <div className="space-y-1 text-sm">
                <div className="block text-left w-full">
                  <span className="font-semibold">Gardner Code:</span>{" "}
                  <span>
                    {selectedItem.gardner_code
                      ? selectedItem.gardner_code.charAt(0).toUpperCase() +
                        selectedItem.gardner_code.slice(1)
                      : "—"}
                  </span>
                </div>
                <div className="block text-left w-full">
                  <span className="font-semibold">
                    Transliteration : Translation
                  </span>
                  {latinEnglishPairs.length > 0 ? (
                    <div className="mt-1 space-y-1 ml-15">
                      {latinEnglishPairs.map((pair, idx) => (
                        <div key={idx} className="text-sm">
                          {/* First line: latin: first meaning */}
                          <div className="flex items-baseline gap-1">
                            <button
                              onClick={() => {
                                if (insertHtmlAtCursor && pair.latin) {
                                  insertHtmlAtCursor(
                                    `<span class="font-latin">${pair.latin}</span> `,
                                  );
                                }
                              }}
                              className="font-latin min-w-[2rem] text-left hover:underline cursor-pointer"
                            >
                              {pair.latin || "—"}
                            </button>
                            <span>:</span>
                            <button
                              onClick={() => {
                                if (
                                  insertTextAtCursor &&
                                  pair.meanings.length > 0
                                ) {
                                  insertTextAtCursor(`${pair.meanings[0]} `);
                                }
                              }}
                              className="text-left hover:underline cursor-pointer"
                            >
                              {pair.meanings.length > 0
                                ? pair.meanings[0]
                                : "—"}
                            </button>
                          </div>
                          {/* Subsequent meanings aligned in column */}
                          {pair.meanings.slice(1).map((meaning, midx) => (
                            <div
                              key={midx}
                              className="flex items-baseline gap-1"
                            >
                              <span className="font-latin min-w-[2rem]"></span>
                              <span>:</span>
                              <button
                                onClick={() => {
                                  if (insertTextAtCursor) {
                                    insertTextAtCursor(`${meaning} `);
                                  }
                                }}
                                className="text-left hover:underline cursor-pointer"
                              >
                                {meaning}
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="font-latin"> —</span>
                  )}
                </div>
              </div>
            </div>
            <button
              className="ml-auto text-[#A66B00] hover:underline"
              onClick={() => setSelected(null)}
            >
              <XIcon className="w-5 h-5 p-[2px] cursor-pointer border border-[#D8A8659C] rounded-full" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
