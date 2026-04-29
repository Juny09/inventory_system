-- ========================================
-- 多租户改造迁移脚本 - 补丁 2
-- 修复 system_settings 的唯一约束（setting_key 全局唯一 → (tenant_id, setting_key) 唯一）
-- ========================================

-- 1. 删除原来的全局唯一约束
ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_setting_key_key;

-- 2. 创建租户内唯一约束（ON CONFLICT 需要真正的唯一约束，不能只是 UNIQUE INDEX）
ALTER TABLE system_settings
  DROP CONSTRAINT IF EXISTS system_settings_tenant_setting_key_unique;
ALTER TABLE system_settings
  ADD CONSTRAINT system_settings_tenant_setting_key_unique UNIQUE (tenant_id, setting_key);

-- 3. 补充性能索引（如尚未存在）
CREATE INDEX IF NOT EXISTS idx_system_settings_tenant_id ON system_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_notifications_tenant_id ON system_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alert_states_tenant_id ON low_stock_alert_states(tenant_id);

-- 4. low_stock_alert_states 同理：(product_id, warehouse_id) UNIQUE 在多租户下其实仍然安全
--    （因为 product_id / warehouse_id 在跨租户之间不会重复），暂不调整以免破坏 ON CONFLICT。

-- 5. marketplace_connections: channel 全局唯一 → (tenant_id, channel) 唯一
ALTER TABLE marketplace_connections DROP CONSTRAINT IF EXISTS marketplace_connections_channel_key;
ALTER TABLE marketplace_connections
  DROP CONSTRAINT IF EXISTS marketplace_connections_tenant_channel_unique;
ALTER TABLE marketplace_connections
  ADD CONSTRAINT marketplace_connections_tenant_channel_unique UNIQUE (tenant_id, channel);

-- 6. marketplace_orders: (channel, external_order_id) 全局唯一 → (tenant_id, channel, external_order_id) 唯一
ALTER TABLE marketplace_orders DROP CONSTRAINT IF EXISTS marketplace_orders_channel_external_order_id_key;
ALTER TABLE marketplace_orders
  DROP CONSTRAINT IF EXISTS marketplace_orders_tenant_channel_order_unique;
ALTER TABLE marketplace_orders
  ADD CONSTRAINT marketplace_orders_tenant_channel_order_unique UNIQUE (tenant_id, channel, external_order_id);

-- 7. 补充索引
CREATE INDEX IF NOT EXISTS idx_marketplace_connections_tenant_id ON marketplace_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_tenant_id ON marketplace_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_tenant_id ON marketplace_order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipping_shipments_tenant_id ON shipping_shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_sync_logs_tenant_id ON marketplace_sync_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_error_logs_tenant_id ON marketplace_error_logs(tenant_id);
