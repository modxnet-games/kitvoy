import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth/admin-session";

/**
 * Standalone admin routes (invoice PDF) — auth only, no dashboard sidebar.
 */
export default async function AdminInvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    redirect("/admin/login");
  }

  return <>{children}</>;
}
