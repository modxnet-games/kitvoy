"use server";

import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin-session";
import { validateAdminCredentials } from "@/lib/auth/admin-auth";

export async function loginAction(
  username: string,
  password: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!username.trim()) {
    return { success: false, error: "Username is required" };
  }

  if (!validateAdminCredentials(username.trim(), password)) {
    return { success: false, error: "Invalid username or password" };
  }

  const session = await getAdminSession();
  session.isAdmin = true;
  session.username = username.trim();
  session.loginAt = Date.now();
  await session.save();

  return { success: true };
}

export async function logoutAction() {
  const session = await getAdminSession();
  session.isAdmin = undefined;
  session.username = undefined;
  session.loginAt = undefined;
  await session.save();
  redirect("/admin/login");
}
