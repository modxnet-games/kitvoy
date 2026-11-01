import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";

/** Returns the User delegate when available; null when prisma.user is missing (e.g. client out of sync). */
function getUserDelegate() {
  const d = prisma.user;
  return d && typeof d.findUnique === "function" ? d : null;
}

export async function findUserByEmail(email: string) {
  const user = getUserDelegate();
  if (!user) return null;
  try {
    return user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  } catch {
    return null;
  }
}

export async function createUser(data: {
  fullName: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
}) {
  const user = getUserDelegate();
  if (!user) throw new Error("User data layer unavailable");
  return user.create({
    data: {
      ...data,
      email: data.email.trim().toLowerCase(),
      role: data.role ?? "CUSTOMER",
    },
  });
}

export async function findUserById(id: string) {
  const user = getUserDelegate();
  if (!user) return null;
  try {
    return user.findUnique({
      where: { id },
    });
  } catch {
    return null;
  }
}

/**
 * Signs in by Google account id, else links the Google account to an existing
 * customer with the same (Google-verified) email, else creates one. The
 * caller must pass only a verified email; see checkGoogleProfile.
 */
export async function findOrCreateGoogleUser(profile: {
  googleId: string;
  email: string;
  fullName: string;
  image?: string;
}) {
  const delegate = getUserDelegate();
  if (!delegate) throw new Error("User data layer unavailable");

  const existing = await delegate.findUnique({
    where: { googleId: profile.googleId },
  });
  if (existing) {
    // Keep the profile picture current; the name stays as the customer set it
    return profile.image && profile.image !== existing.image
      ? delegate.update({ where: { id: existing.id }, data: { image: profile.image } })
      : existing;
  }

  const byEmail = await delegate.findUnique({
    where: { email: profile.email.trim().toLowerCase() },
  });
  if (byEmail) {
    return delegate.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.googleId,
        image: profile.image ?? byEmail.image,
      },
    });
  }

  return delegate.create({
    data: {
      fullName: profile.fullName,
      email: profile.email.trim().toLowerCase(),
      googleId: profile.googleId,
      image: profile.image,
      role: "CUSTOMER",
    },
  });
}
