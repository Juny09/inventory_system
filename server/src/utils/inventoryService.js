// 统一封装库存增减逻辑，避免多个接口重复写事务代码
async function ensureStockRow(client, productId, warehouseId) {
  await client.query(
    `
      INSERT INTO stock_levels (product_id, warehouse_id, quantity)
      VALUES ($1, $2, 0)
      ON CONFLICT (product_id, warehouse_id) DO NOTHING
    `,
    [productId, warehouseId],
  )
}

async function getStockQuantity(client, productId, warehouseId) {
  const result = await client.query(
    `
      SELECT quantity
      FROM stock_levels
      WHERE product_id = $1 AND warehouse_id = $2
    `,
    [productId, warehouseId],
  )

  return Number(result.rows[0]?.quantity || 0)
}

async function updateStock(client, productId, warehouseId, nextQuantity) {
  await client.query(
    `
      UPDATE stock_levels
      SET quantity = $3, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $1 AND warehouse_id = $2
    `,
    [productId, warehouseId, nextQuantity],
  )
}

module.exports = {
  ensureStockRow,
  getStockQuantity,
  updateStock,
}
