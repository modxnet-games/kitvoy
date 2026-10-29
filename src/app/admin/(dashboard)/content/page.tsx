import { getHomepageContent } from "@/lib/data/site-content";
import { HomepageContentForm } from "./homepage-content-form";

export default async function AdminContentPage() {
  const content = await getHomepageContent();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Homepage Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the marketing content displayed on your storefront homepage.
        </p>
      </div>
      <HomepageContentForm content={content} />
    </div>
  );
}
