import InventoryDetailPage from "../detail-page";

export default async function InventoryRoute({
  params,
}: {
  params: Promise<{ inventoryId: string }>;
}) {
  const { inventoryId } = await params;
  return <InventoryDetailPage inventoryId={inventoryId} />;
}
