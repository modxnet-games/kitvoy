"use server";
import { findUserByEmail, createUser } from "@/lib/data/users";
import { hashPassword } from "@/lib/auth/password";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { saveSubscriberEmail } from "@/lib/subscribers";

const MIN_PASSWORD_LENGTH = 8;
const MAX_FULL_NAME = 100;
const MAX_EMAIL = 255;

export type RegisterResult =
  | { success: true }
  | { success: false; error: string };

function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export async function registerAction(
  fullName: string,
  email: string,
  password: string,
  confirmPassword: string,
  redirectUrl: string = "/shop"
): Promise<RegisterResult> {
  const name = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (!name) {
    return { success: false, error: "auth.register.fullNameRequired" };
  }
  if (name.length > MAX_FULL_NAME) {
    return { success: false, error: "auth.register.fullNameTooLong" };
  }
  if (!trimmedEmail) {
    return { success: false, error: "auth.register.emailRequired" };
  }
  if (!validateEmail(trimmedEmail)) {
    return { success: false, error: "auth.register.invalidEmail" };
  }
  if (trimmedEmail.length > MAX_EMAIL) {
    return { success: false, error: "auth.register.emailTooLong" };
  }
  if (!password) {
    return { success: false, error: "auth.register.passwordRequired" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      success: false,
      error: "auth.register.passwordTooShort",
    };
  }
  if (password !== confirmPassword) {
    return { success: false, error: "auth.register.passwordsDoNotMatch" };
  }

  const existing = await findUserByEmail(trimmedEmail);
  if (existing) {
    return { success: false, error: "auth.register.emailAlreadyExists" };
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({
    fullName: name,
    email: trimmedEmail,
    passwordHash,
  });

  await saveSubscriberEmail(trimmedEmail, "register");

  const session = await getCustomerSession();
  session.userId = user.id;
  session.email = user.email;
  session.fullName = user.fullName;
  session.loginAt = Date.now();
  await session.save();

  // Keep this action modal-friendly: client components decide whether to
  // push/close/navigate after successful registration.
  void redirectUrl;
  return { success: true };
}
