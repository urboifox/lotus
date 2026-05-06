import { X } from "lucide-react";
interface IProps {
  search: string;
  setSearch: (search: string) => void;
}
const Search = ({ search, setSearch }: IProps) => {
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value.trim());
  };
  return (
    <div className="relative">
      <input
        value={search}
        onChange={handleSearch}
        type="text"
        className={`w-full p-2 rounded-full border border-[#D8A86585]
            outline-none bg-[#FEFBF7] text-[#514F4A] focus:bg-[#FAE5C8] focus:outline-none
            focus:ring-1 focus:ring-[#D8A86585]`}
      />
      {search.trim() !== "" && (
        <X
          className={`w-4 h-4 cursor-pointer absolute right-3 top-1/2 -translate-y-1/2
                text-black hover:text-red-500 transition-all duration-300 hover:scale-110`}
          onClick={() => setSearch("")}
        />
      )}
    </div>
  );
};

export default Search;
