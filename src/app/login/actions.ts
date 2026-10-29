"use server";

import { redirect } from "next/navigation";
import { findUserByEmail } from "@/lib/data/users";
import { verifyPassword } from "@/lib/auth/password";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { clearCustomerSession } from "@/lib/auth/customer-session";
import { saveSubscriberEmail } from "@/lib/subscribers";

export type LoginResult =
  | { success: true }
  | { success: false; error: string };

export async function loginAction(
  email: string,
  password: string
): Promise<LoginResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { success: false, error: "auth.login.emailRequired" };
  }
  if (!password) {
    return { success: false, error: "auth.login.passwordRequired" };
  }

  const user = await findUserByEmail(trimmed);
  if (!user) {
    return { success: false, error: "auth.login.invalidCredentials" };
  }

  if (user.role !== "CUSTOMER") {
    return { success: false, error: "auth.login.invalidCredentials" };
  }

  if (!user.passwordHash) {
    return { success: false, error: "auth.login.invalidCredentials" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { success: false, error: "auth.login.invalidCredentials" };
  }

  const session = await getCustomerSession();
  session.userId = user.id;
  session.email = user.email;
  session.fullName = user.fullName;
  session.loginAt = Date.now();
  await session.save();
  await saveSubscriberEmail(user.email, "login");

  return { success: true };
}

export async function logoutAction() {
  await clearCustomerSession();
  redirect("/");
}
