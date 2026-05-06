import { cn } from "@/lib/utils";
const CustomSection = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <section className={cn(`container my-8`, className)}>{children}</section>
  );
};

export default CustomSection;
