import { cn } from "@/lib/utils";

interface CheckoutSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function CheckoutSection({
  title,
  children,
  className,
}: CheckoutSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
