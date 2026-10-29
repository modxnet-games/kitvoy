import { prisma } from "@/lib/db";

export interface NavItem {
  id: string;
  label: string;
  link: string;
  position: number;
  isVisible: boolean;
}

const DEFAULT_NAV: Omit<NavItem, "id">[] = [
  { label: "New Arrivals", link: "/new-arrivals", position: 0, isVisible: true },
  { label: "Shop", link: "/shop", position: 1, isVisible: true },
  { label: "Collections", link: "/collections", position: 2, isVisible: true },
  { label: "Sale", link: "/sale", position: 3, isVisible: true },
];

export async function getNavigationItems(): Promise<NavItem[]> {
  try {
    const items = await prisma.navigationItem.findMany({
      orderBy: { position: "asc" },
    });
    if (items.length === 0) return DEFAULT_NAV.map((n, i) => ({ ...n, id: `default-${i}` }));
    return items;
  } catch {
    return DEFAULT_NAV.map((n, i) => ({ ...n, id: `default-${i}` }));
  }
}

export async function getVisibleNavigationItems(): Promise<NavItem[]> {
  const items = await getNavigationItems();
  return items.filter((i) => i.isVisible);
}

export async function getAllNavigationItems(): Promise<NavItem[]> {
  try {
    return await prisma.navigationItem.findMany({
      orderBy: { position: "asc" },
    });
  } catch {
    return [];
  }
}

export async function upsertNavigationItem(
  data: { id?: string; label: string; link: string; position: number; isVisible: boolean },
): Promise<NavItem> {
  if (data.id) {
    return prisma.navigationItem.update({
      where: { id: data.id },
      data: {
        label: data.label.trim(),
        link: data.link.trim(),
        position: data.position,
        isVisible: data.isVisible,
      },
    });
  }
  return prisma.navigationItem.create({
    data: {
      label: data.label.trim(),
      link: data.link.trim(),
      position: data.position,
      isVisible: data.isVisible,
    },
  });
}

export async function deleteNavigationItem(id: string): Promise<void> {
  await prisma.navigationItem.delete({ where: { id } });
}

export async function seedDefaultNavigation(): Promise<void> {
  const count = await prisma.navigationItem.count();
  if (count > 0) return;
  await prisma.navigationItem.createMany({
    data: DEFAULT_NAV.map((n) => ({ ...n })),
  });
}
