/**
 * Print segment only — no nested <html>/<body> (invalid under App Router root).
 * The page names itself (the slip's title is also its PDF file name).
 */
export default function OrderPrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
