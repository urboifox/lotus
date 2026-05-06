import { GetAllGardners } from "@/services/svg";

// Mapping of family codes to display names
const FAMILY_DISPLAY_NAMES: Record<string, string> = {
  a: "A. Man and his occupations",
  aa: "Aa. Un classed",
  b: "B. Woman and her occupations",
  c: "C. Anthropomorphic Deities",
  d: "D. Parts of the human body",
  e: "E. Mammals",
  f: "F. Parts of Mammals",
  g: "G. Birds",
  h: "H. Parts of Birds",
  i: "I. Amphibious animals, reptiles, etc.",
  k: "K. Fishes and parts of fishes",
  l: "L. Invertebrata and lesser animals",
  m: "M. Trees and plants",
  n: "N. Sky, earth, water",
  o: "O. Buildings, parts of buildings, etc.",
  p: "P. Ships and parts of ships",
  q: "Q. Domestic and funerary furniture",
  r: "R. Temple furniture and sacred emblems",
  s: "S. Crowns, Dress, Staves, etc.",
  t: "T. Warfare, hunting, butchery",
  u: "U. Agriculture, crafts, and professions",
  v: "V. Rope, Fibre, baskets, bags, etc.",
  w: "W. Vessels of stone and earthenware",
  x: "X. Loaves and cakes",
  y: "Y. Writings, games, music",
  z: "Z. Strokes",
};

const FamilySelect = ({
  setFamily,
}: {
  setFamily: (family: string) => void;
}) => {
  const { data, isLoading, error } = GetAllGardners();
  const resolvedData = Array.isArray(data) ? data : [];
  const hasInvalidData =
    !isLoading && data !== undefined && !Array.isArray(data);
  const hasError = Boolean(error) || hasInvalidData;
  const fallbackFamilies = Object.keys(FAMILY_DISPLAY_NAMES).map((family) => ({
    id: family,
    family,
  }));
  return (
    <select
      className="w-full p-2 rounded-full border border-[#D8A86585] bg-[#FEFBF7] text-[#514F4A]"
      onChange={(e) => {
        setFamily(e.target.value);
      }}
    >
      <option value="" hidden></option>
      {isLoading ? (
        <option value="" disabled>
          Loading families...
        </option>
      ) : (
        // Sort families: a-z first, then aa last
        [...(hasError ? fallbackFamilies : resolvedData)]
          .sort((a: { family: string }, b: { family: string }) => {
            // Move "aa" to the end
            if (a.family.toLowerCase() === "aa") return 1;
            if (b.family.toLowerCase() === "aa") return -1;
            // Normal alphabetical sort for others
            return a.family.localeCompare(b.family);
          })
          .map(({ id, family }: { id: string; family: string }) => (
            <option key={id} value={family}>
              {FAMILY_DISPLAY_NAMES[family.toLowerCase()] || family}
            </option>
          ))
      )}
    </select>
  );
};

export default FamilySelect;
