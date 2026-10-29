export interface MockCategory {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
}

export const mockCategories: MockCategory[] = [
  { id: "cat-1", name: "Accessories", slug: "accessories", productCount: 12 },
  { id: "cat-2", name: "Clothing", slug: "clothing", productCount: 24 },
  { id: "cat-3", name: "Footwear", slug: "footwear", productCount: 8 },
  { id: "cat-4", name: "Watches", slug: "watches", productCount: 6 },
  { id: "cat-5", name: "Bags", slug: "bags", productCount: 10 },
];
