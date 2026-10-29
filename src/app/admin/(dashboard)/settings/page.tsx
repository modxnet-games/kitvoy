import Link from "next/link";
import { Settings, FileText, Navigation, Mail, FolderTree, ShoppingBag } from "lucide-react";

const cards = [
  {
    href: "/admin/settings/store",
    title: "Store Settings",
    description: "General store info, contacts, and core configuration.",
    icon: Settings,
  },
  {
    href: "/admin/content",
    title: "Homepage Content",
    description: "Edit homepage text, banners, labels, and sections.",
    icon: FileText,
  },
  {
    href: "/admin/navigation",
    title: "Navigation",
    description: "Manage menu links and storefront navigation labels.",
    icon: Navigation,
  },
  {
    href: "/admin/subscribers",
    title: "Emails / Subscribers",
    description: "View, copy, and export collected customer emails.",
    icon: Mail,
  },
  {
    href: "/admin/categories",
    title: "Categories",
    description: "Create, update, and remove product categories.",
    icon: FolderTree,
  },
  {
    href: "/admin/products",
    title: "Products",
    description: "Add products, edit details, pricing, and stock.",
    icon: ShoppingBag,
  },
];

export default function AdminSettingsHubPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Settings Hub</h1>
        <p className="mt-1 text-muted-foreground">
          Access all important store edit controls from one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/40"
          >
            <card.icon className="size-5 text-primary" />
            <h2 className="mt-3 font-semibold">{card.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-primary">
              Edit
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
