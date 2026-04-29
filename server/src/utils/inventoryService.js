// 统一封装库存增减逻辑，避免多个接口重复写事务代码
// 所有库存操作均按 tenant_id 隔离
async function ensureStockRow(client, productId, warehouseId, tenantId) {
  await client.query(
    `
      INSERT INTO stock_levels (tenant_id, product_id, warehouse_id, quantity, allocated_quantity)
      VALUES ($1, $2, $3, 0, 0)
      ON CONFLICT (product_id, warehouse_id) DO NOTHING
    `,
    [tenantId, productId, warehouseId],
  )
}

async function getStockQuantity(client, productId, warehouseId, tenantId) {
  const result = await client.query(
    `
      SELECT quantity, allocated_quantity
      FROM stock_levels
      WHERE product_id = $1 AND warehouse_id = $2 AND tenant_id = $3
    `,
    [productId, warehouseId, tenantId],
  )

  return {
    onHandQuantity: Number(result.rows[0]?.quantity || 0),
    allocatedQuantity: Number(result.rows[0]?.allocated_quantity || 0),
  }
}

async function updateStock(client, productId, warehouseId, nextQuantity, nextAllocatedQuantity, tenantId) {
  await client.query(
    `
      UPDATE stock_levels
      SET quantity = $3, allocated_quantity = $4, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $1 AND warehouse_id = $2 AND tenant_id = $5
    `,
    [productId, warehouseId, nextQuantity, nextAllocatedQuantity, tenantId],
  )
}

module.exports = {
  ensureStockRow,
  getStockQuantity,
  updateStock,
}
