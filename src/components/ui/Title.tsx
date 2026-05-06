import { cn } from "@/lib/utils";
const Title = ({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        `mb-8 flex flex-col justify-between items-center ${className}`
      )}
    >
      <h2 className="text-3xl md:text-4xl font-bold text-secondary text-center">
        {title}
      </h2>
      <p className="text-xl md:text-3xl font-bold text-primary my-3 max-w-3xl text-center leading-tight">
        {description}
      </p>
    </div>
  );
};

export default Title;
