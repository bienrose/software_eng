import ManualInventoryPage from "../../../../inventory_creator/manual/manual-page";

export default async function EditInventoryManualRoute({ params }: { params: Promise<{ inventoryId: string }> }) {
  const { inventoryId } = await params;
  return <ManualInventoryPage inventoryId={inventoryId} />;
}
