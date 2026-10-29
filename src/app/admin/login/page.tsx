import { redirect } from "next/navigation";
import { AdminLoginForm } from "./login-form";
import { isAdminAuthenticated } from "@/lib/auth/admin-session";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Admin Login</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access the Kitvoy admin dashboard
          </p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
