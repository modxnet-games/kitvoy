import { getCustomer } from "@/lib/auth/customer-session";
import { AccountContent } from "./account-content";
import { prisma } from "@/lib/db";

export default async function AccountPage() {
  const customer = await getCustomer();
  if (!customer) return null;

  const userImage = await prisma.user.findUnique({
    where: { id: customer.userId },
    select: { image: true },
  });

  return (
    <AccountContent
      customer={{
        fullName: customer.fullName,
        email: customer.email,
        image: userImage?.image ?? null,
      }}
    />
  );
}
