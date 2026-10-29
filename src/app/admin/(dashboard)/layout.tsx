import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  FolderTree,
  Star,
  FileText,
  LogOut,
  Menu,
  Settings,
  Navigation,
  Mail,
} from "lucide-react";

import { isAdminAuthenticated } from "@/lib/auth/admin-session";
import { logoutAction } from "@/app/admin/login/actions";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/products", label: "Products", icon: ShoppingBag },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/navigation", label: "Navigation", icon: Navigation },
  { href: "/admin/subscribers", label: "Subscribers", icon: Mail },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur-sm px-4 md:hidden">
        <Link href="/admin" className="text-base font-bold tracking-tight">
          Kitvoy Admin
        </Link>
        <label
          htmlFor="admin-nav-toggle"
          className="cursor-pointer rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Menu className="size-5" />
        </label>
      </div>

      <input type="checkbox" id="admin-nav-toggle" className="peer hidden" />

      {/* Sidebar overlay for mobile */}
      <label
        htmlFor="admin-nav-toggle"
        className="fixed inset-0 z-30 hidden bg-black/40 backdrop-blur-sm peer-checked:block md:!hidden"
      />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 w-64 shrink-0 -translate-x-full border-r bg-background transition-transform duration-200 peer-checked:translate-x-0 md:translate-x-0">
        <div className="hidden h-16 items-center border-b px-6 md:flex">
          <Link href="/admin" className="text-base font-bold tracking-tight">
            Kitvoy Admin
          </Link>
        </div>
        <div className="flex h-14 items-center justify-between border-b px-6 md:hidden">
          <Link href="/admin" className="text-base font-bold tracking-tight">
            Kitvoy Admin
          </Link>
          <label
            htmlFor="admin-nav-toggle"
            className="cursor-pointer rounded-lg p-1 text-muted-foreground hover:text-foreground"
          >
            ✕
          </label>
        </div>
        <nav className="flex flex-col gap-1 p-3 mt-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-primary/5 hover:text-foreground"
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-3 right-3">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/5 hover:text-destructive"
            >
              <LogOut className="size-[18px]" />
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 md:pl-64">
        <div className="container py-6 md:py-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
