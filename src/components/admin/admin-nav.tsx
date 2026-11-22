"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderTree, LayoutDashboard, Navigation, Package, Settings, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/products", label: "Products", icon: ShoppingBag },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/navigation", label: "Navigation", icon: Navigation },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/**
 * The dashboard's menu. On a phone the menu slides over the page (a checkbox
 * in the dashboard layout holds it open), so choosing a page closes it.
 */
export function AdminNav() {
  const pathname = usePathname();

  const closeMenu = () => {
    const toggle = document.getElementById("admin-nav-toggle");
    if (toggle instanceof HTMLInputElement) toggle.checked = false;
  };

  return (
    <nav className="mt-2 flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeMenu}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
            )}
          >
            <item.icon className="size-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
