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
  postItemsToStock,
}

/**
 * 将一组明细按 direction (+1 入库 / -1 反扣) 应用到 stock_levels，
 * 并为每一行在 stock_movements 写入审计记录。
 *
 * @param {import('pg').PoolClient} client 必须已在事务中
 * @param {object} options
 * @param {number} options.tenantId
 * @param {number} options.warehouseId  目标仓库
 * @param {Array<{product_id:number, quantity:number}>} options.items 明细
 * @param {1|-1} options.direction  1=入库, -1=反扣
 * @param {string} options.referenceNo  审计用单号（DO/Invoice 编号）
 * @param {string|null} options.notes
 * @param {number|null} options.supplierId
 * @param {number} options.userId
 */
async function postItemsToStock(client, options) {
  const {
    tenantId,
    warehouseId,
    items,
    direction,
    referenceNo,
    notes = null,
    supplierId = null,
    userId,
  } = options

  if (!warehouseId) throw new Error('warehouseId is required to post stock.')
  if (direction !== 1 && direction !== -1) throw new Error('direction must be 1 or -1')

  // 校验仓库所属租户
  const wh = await client.query(
    'SELECT id FROM warehouses WHERE id = $1 AND tenant_id = $2',
    [warehouseId, tenantId],
  )
  if (!wh.rows[0]) throw new Error('Warehouse not found in current company.')

  // 按 product 聚合，避免同一 product 多行分别查/写
  const aggregated = new Map()
  for (const it of items || []) {
    const pid = Number(it.product_id)
    const qty = Number(it.quantity) || 0
    if (!pid || qty <= 0) continue
    aggregated.set(pid, (aggregated.get(pid) || 0) + qty)
  }

  for (const [productId, qty] of aggregated.entries()) {
    // 校验 product 所属租户
    const pCheck = await client.query(
      'SELECT id FROM products WHERE id = $1 AND tenant_id = $2',
      [productId, tenantId],
    )
    if (!pCheck.rows[0]) throw new Error(`Product ${productId} not found in current company.`)

    await ensureStockRow(client, productId, warehouseId, tenantId)
    const current = await getStockQuantity(client, productId, warehouseId, tenantId)
    const nextQty = current.onHandQuantity + direction * qty
    if (nextQty < 0) {
      throw new Error(`Stock for product ${productId} would become negative.`)
    }

    await updateStock(client, productId, warehouseId, nextQty, current.allocatedQuantity, tenantId)

    const movementType = direction === 1 ? 'IN' : 'OUT'
    const srcCol = direction === 1 ? null : warehouseId
    const dstCol = direction === 1 ? warehouseId : null

    await client.query(
      `INSERT INTO stock_movements (
         tenant_id, movement_type, product_id,
         source_warehouse_id, destination_warehouse_id,
         quantity, reference_no, notes, supplier_id, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        tenantId,
        movementType,
        productId,
        srcCol,
        dstCol,
        qty,
        referenceNo || null,
        notes,
        supplierId,
        userId,
      ],
    )
  }
}
