import { getAllNavigationItems } from "@/lib/data/navigation";
import { NavigationManager } from "./navigation-manager";

export default async function AdminNavigationPage() {
  const items = await getAllNavigationItems();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Navigation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the links displayed in the storefront navigation bar.
        </p>
      </div>
      <NavigationManager initialItems={items} />
    </div>
  );
}
