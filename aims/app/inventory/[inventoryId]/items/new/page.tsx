import NewInventoryItemForm from "../../../../inventory/new-item-form";

export default async function NewItemPage({ params }: { params: Promise<{ inventoryId: string }> }) {
  const { inventoryId } = await params;
  return <NewInventoryItemForm inventoryId={inventoryId} />;
}
