INSERT IGNORE INTO inventory_categories (id, name, slug, description)
VALUES ('10000000-0000-4000-8000-000000000001', 'Demand Training Samples', 'demand-training-samples', 'Sample inventory for demand prediction testing');

INSERT IGNORE INTO inventory_schema_versions (id, category_id, version_number, status, generation_method, display_labels, published_at)
VALUES ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 1, 'active', 'manual', JSON_OBJECT(), CURRENT_TIMESTAMP(3));

INSERT IGNORE INTO inventory_items (id, category_id, schema_version_id, item_code, name, unit, quantity_on_hand, reorder_level, custom_attributes)
VALUES ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'DMD-SAMPLE-01', 'Demand Sample Kit', 'units', 600, 80, JSON_OBJECT('lead_time_days', 7));

INSERT INTO inventory_transactions (id, inventory_item_id, movement_type, quantity, balance_after, reference, notes, occurred_at)
WITH RECURSIVE days AS (
  SELECT 1 AS day_offset
  UNION ALL
  SELECT day_offset + 1 FROM days WHERE day_offset < 45
)
SELECT UUID(), '10000000-0000-4000-8000-000000000003', 'stock_out',
  CASE WHEN day_offset % 7 IN (1, 2) THEN 14 WHEN day_offset % 7 IN (3, 4) THEN 7 ELSE 2 END,
  0, 'demand-sample', 'Demand prediction sample history', DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL day_offset DAY)
FROM days
WHERE day_offset % 3 <> 0
  AND NOT EXISTS (SELECT 1 FROM inventory_transactions WHERE reference = 'demand-sample');

INSERT INTO inventory_transactions (id, inventory_item_id, movement_type, quantity, balance_after, reference, notes)
SELECT UUID(), '10000000-0000-4000-8000-000000000003', 'stock_out', 300, 0,
  'demand-sample-demo-adjustment', 'Demo stock reduction to make replenishment visible'
WHERE EXISTS (SELECT 1 FROM inventory_items WHERE id = '10000000-0000-4000-8000-000000000003')
  AND NOT EXISTS (SELECT 1 FROM inventory_transactions WHERE reference = 'demand-sample-demo-adjustment');
