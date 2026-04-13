# Postman Backend Guide

## 1. Base URL
- Local: `http://localhost:4000/api`

## 2. Auth Headers
- 登录后把 `token` 放到 `Authorization`：
  - `Authorization: Bearer {{token}}`
- 成本解锁后把 `cost_access_token` 放到：
  - `x-cost-access-token: {{cost_access_token}}`

## 3. 推荐 Postman 环境变量
- `base_url` = `http://localhost:4000/api`
- `token` = 空字符串
- `cost_access_token` = 空字符串
- `product_id` = 空字符串
- `warehouse_id` = 空字符串
- `stock_count_id` = 空字符串

## 4. 快速测试流程
1) `POST {{base_url}}/auth/login` 获取 `token`
2) `POST {{base_url}}/products/cost-access` 获取 `cost_access_token`
3) 调 `GET {{base_url}}/products`、`GET {{base_url}}/inventory`、`GET {{base_url}}/reports/inventory` 验证成本脱敏与解锁
4) 用 `POST/PUT/DELETE {{base_url}}/products` 做商品增删改查

## 5. 认证模块

### POST /auth/login
- Body:
```json
{
  "email": "admin@inventory.local",
  "password": "Admin@123"
}
```
- 响应包含 `token` 与 `user`

### GET /auth/me
- Header: `Authorization`
- 返回当前用户

## 6. 主数据模块

### Users
- GET `/users?search=&page=1&pageSize=10`
- POST `/users` (ADMIN)
```json
{
  "fullName": "Test User",
  "email": "test.user@example.com",
  "password": "Test@123",
  "role": "STAFF"
}
```

### Categories
- GET `/categories?search=&page=1&pageSize=10`
- GET `/categories?all=true`
- POST `/categories`
- PUT `/categories/:id`
- DELETE `/categories/:id`

### Warehouses
- GET `/warehouses?search=&activeOnly=false&page=1&pageSize=10`
- GET `/warehouses?all=true&activeOnly=true`
- POST `/warehouses`
- PUT `/warehouses/:id`
- DELETE `/warehouses/:id`

## 7. 商品模块（含多图 / 多规则 / 渠道定价）

### GET /products
- 支持参数：
  - `search`
  - `categoryId`
  - `status=all|active|inactive`
  - `hasBarcode=all|yes|no`
  - `pricingChannel=retail|wholesale|vip`
  - `page` `pageSize`
- 返回字段：
  - `images`
  - `pricing_rules`
  - `active_pricing_rule`
  - `active_suggested_price`
  - `cost_price`（未解锁时为 `null`）

### GET /products/:id
- 支持参数：
  - `pricingChannel=retail|wholesale|vip`
- 返回：
  - `product`
  - `images`
  - `pricingRules`
  - `stockLevels`
  - `recentMovements`
  - `alerts`
  - `summary`

### POST /products/cost-access
- Body:
```json
{
  "passcode": "Admin@123"
}
```
- 返回 `token`，用于 `x-cost-access-token`

### POST /products
```json
{
  "name": "Laser Cutter X1",
  "sku": "SKU-LASER-X1",
  "productCode": "PRD-LASER-X1",
  "barcode": "690000000001",
  "images": [
    {
      "imageData": "data:image/jpeg;base64,...",
      "isPrimary": true,
      "sortOrder": 0
    },
    {
      "imageData": "data:image/jpeg;base64,...",
      "isPrimary": false,
      "sortOrder": 1
    }
  ],
  "description": "Machine overview",
  "usageGuide": "How to use",
  "pros": "Stable output",
  "cons": "Need warm-up",
  "categoryId": 1,
  "unit": "pcs",
  "costPrice": 1000,
  "sellingPrice": 1600,
  "pricingRules": [
    {
      "ruleName": "Retail",
      "channelKey": "retail",
      "markupPercentage": 30,
      "isDefault": true,
      "sortOrder": 0
    },
    {
      "ruleName": "Wholesale",
      "channelKey": "wholesale",
      "markupPercentage": 15,
      "isDefault": false,
      "sortOrder": 1
    }
  ],
  "reorderLevel": 5,
  "isActive": true
}
```

### PUT /products/:id
- Body 与 POST `/products` 同结构

### DELETE /products/:id
- ADMIN

## 8. 库存模块

### GET /inventory
- 支持参数：
  - `search`
  - `categoryId`
  - `warehouseId`
  - `lowStockOnly=true|false`
  - `page` `pageSize`
- `cost_price` 未解锁时为 `null`

### GET /inventory/transactions
- 参数：
  - `search`
  - `movementType=all|IN|OUT|TRANSFER`
  - `page` `pageSize`

### POST /inventory/stock-in
```json
{
  "productId": 1,
  "warehouseId": 1,
  "quantity": 20,
  "referenceNo": "IN-001",
  "notes": "Stock in test"
}
```

### POST /inventory/stock-out
```json
{
  "productId": 1,
  "warehouseId": 1,
  "quantity": 5,
  "referenceNo": "OUT-001",
  "notes": "Stock out test"
}
```

### POST /inventory/transfer
```json
{
  "productId": 1,
  "sourceWarehouseId": 1,
  "destinationWarehouseId": 2,
  "quantity": 3,
  "referenceNo": "TR-001",
  "notes": "Transfer test"
}
```

## 9. Dashboard 模块
- GET `/dashboard/summary`

## 10. Reports 模块

### GET /reports/inventory
- 参数：
  - `search`
  - `page` `pageSize`
  - `all=true`
- 字段 `cost_price` 与 `stock_value` 未解锁时为 `null`

### GET /reports/movements
- 参数：
  - `startDate`
  - `endDate`
  - `search`
  - `page` `pageSize`
  - `all=true`

## 11. Alerts 模块

### GET /alerts/low-stock
- 参数：
  - `search`
  - `warehouseId`
  - `status=all|OPEN|READ|IGNORED`
  - `page` `pageSize`
  - `all=true`

### PUT /alerts/low-stock/:productId/:warehouseId
```json
{
  "status": "READ",
  "assignedTo": 1,
  "notes": "Checked by manager"
}
```

### POST /alerts/low-stock/bulk-update
```json
{
  "status": "READ",
  "assignedTo": 1,
  "notes": "Bulk update",
  "items": [
    {
      "productId": 1,
      "warehouseId": 1
    },
    {
      "productId": 2,
      "warehouseId": 1,
      "status": "IGNORED"
    }
  ]
}
```

## 12. Audit Logs 模块
- GET `/audit-logs?search=&action=&entityType=&startDate=&endDate=&page=1&pageSize=20`

## 13. Stock Counts 模块
- GET `/stock-counts?search=&status=all&page=1&pageSize=10`
- POST `/stock-counts`
```json
{
  "warehouseId": 1,
  "notes": "Monthly count"
}
```
- GET `/stock-counts/:id`
- PUT `/stock-counts/:id/items`
```json
{
  "items": [
    {
      "id": 10,
      "countedQuantity": 25,
      "notes": "Shelf checked"
    }
  ]
}
```
- POST `/stock-counts/:id/complete`
- POST `/stock-counts/:id/apply` (ADMIN / MANAGER)

## 14. Health Check
- GET `/health`
