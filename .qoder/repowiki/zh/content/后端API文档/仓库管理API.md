# 仓库管理API

<cite>
**本文档引用的文件**
- [inventoryRoutes.js](file://server/src/routes/inventoryRoutes.js)
- [inventoryService.js](file://server/src/utils/inventoryService.js)
- [schema.sql](file://server/database/schema.sql)
- [auth.js](file://server/src/middleware/auth.js)
- [auditTrail.js](file://server/src/middleware/auditTrail.js)
- [tenant.js](file://server/src/utils/tenant.js)
- [pagination.js](file://server/src/utils/pagination.js)
- [auditLog.js](file://server/src/utils/auditLog.js)
- [seed.sql](file://server/database/seed.sql)
- [WarehousesPage.vue](file://web/src/pages/WarehousesPage.vue)
- [api.js](file://web/src/services/api.js)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介

本仓库管理API是库存管理系统的核心模块，负责管理仓库的CRUD操作、库存分配和转移业务逻辑。该系统采用多租户架构设计，确保不同公司之间的数据完全隔离，同时提供了完善的权限控制、审计日志和数据完整性约束。

系统支持以下主要功能：
- 仓库创建、读取、更新、删除（CRUD）操作
- 多仓库库存管理与容量控制
- 库存分配与释放机制
- 库存入库、出库和仓库间转移
- 完整的操作审计和权限控制

## 项目结构

```mermaid
graph TB
subgraph "后端服务器"
A[Express 应用]
B[路由层]
C[中间件层]
D[服务层]
E[工具层]
F[数据库]
end
subgraph "前端应用"
G[Vue.js 页面]
H[API 服务]
I[状态管理]
end
subgraph "配置"
J[数据库配置]
K[认证配置]
L[环境变量]
end
G --> H
H --> A
A --> B
A --> C
A --> D
A --> E
B --> F
C --> F
D --> F
E --> F
J --> F
K --> C
L --> A
```

**图表来源**
- [inventoryRoutes.js:1-536](file://server/src/routes/inventoryRoutes.js#L1-L536)
- [auth.js:1-87](file://server/src/middleware/auth.js#L1-L87)

**章节来源**
- [inventoryRoutes.js:1-536](file://server/src/routes/inventoryRoutes.js#L1-L536)
- [schema.sql:1-447](file://server/database/schema.sql#L1-L447)

## 核心组件

### 数据模型架构

系统基于以下核心数据模型构建：

```mermaid
erDiagram
WAREHOUSE {
int id PK
string name
string code UK
text address
string manager_name
boolean is_active
timestamp created_at
}
PRODUCT {
int id PK
string name
string sku UK
string barcode UK
int category_id FK
string unit
numeric cost_price
numeric selling_price
int reorder_level
boolean is_active
timestamp created_at
}
STOCK_LEVEL {
int id PK
int product_id FK
int warehouse_id FK
int quantity
int allocated_quantity
timestamp updated_at
}
STOCK_MOVEMENT {
int id PK
string movement_type
int product_id FK
int source_warehouse_id FK
int destination_warehouse_id FK
int quantity
string reference_no
text notes
int created_by FK
timestamp created_at
}
WAREHOUSE ||--o{ STOCK_LEVEL : contains
PRODUCT ||--o{ STOCK_LEVEL : tracked_in
WAREHOUSE ||--o{ STOCK_MOVEMENT : source_of
PRODUCT ||--o{ STOCK_MOVEMENT : affected_by
```

**图表来源**
- [schema.sql:22-248](file://server/database/schema.sql#L22-L248)

### 认证与授权架构

```mermaid
sequenceDiagram
participant Client as 客户端
participant Auth as 认证中间件
participant DB as 数据库
participant Token as JWT令牌
participant Role as 角色验证
Client->>Auth : 发送认证请求
Auth->>Token : 验证JWT令牌
Token->>DB : 查询用户信息
DB-->>Token : 返回用户数据
Token-->>Auth : 验证通过
Auth->>Role : 检查角色权限
Role-->>Auth : 权限验证结果
Auth-->>Client : 授权访问
```

**图表来源**
- [auth.js:5-61](file://server/src/middleware/auth.js#L5-L61)
- [auth.js:64-72](file://server/src/middleware/auth.js#L64-L72)

**章节来源**
- [schema.sql:22-248](file://server/database/schema.sql#L22-L248)
- [auth.js:1-87](file://server/src/middleware/auth.js#L1-L87)

## 架构概览

### 系统架构图

```mermaid
graph TB
subgraph "客户端层"
Web[Web浏览器]
Mobile[移动应用]
end
subgraph "API网关层"
Router[路由处理器]
Middleware[中间件链]
end
subgraph "业务逻辑层"
Inventory[库存服务]
Warehouse[仓库服务]
Movement[移动处理]
Allocation[分配管理]
end
subgraph "数据持久层"
DB[(PostgreSQL数据库)]
Schema[数据模式]
end
subgraph "安全层"
Auth[身份认证]
Audit[审计日志]
Tenant[租户隔离]
end
Web --> Router
Mobile --> Router
Router --> Middleware
Middleware --> Inventory
Middleware --> Warehouse
Middleware --> Movement
Middleware --> Allocation
Inventory --> DB
Warehouse --> DB
Movement --> DB
Allocation --> DB
DB --> Schema
Middleware --> Auth
Middleware --> Audit
Middleware --> Tenant
```

**图表来源**
- [inventoryRoutes.js:1-536](file://server/src/routes/inventoryRoutes.js#L1-L536)
- [auditTrail.js:47-81](file://server/src/middleware/auditTrail.js#L47-L81)

## 详细组件分析

### 仓库管理API

#### 仓库CRUD操作

仓库管理API提供了完整的CRUD操作接口：

**仓库创建接口**
- **URL**: `POST /api/warehouses`
- **权限**: ADMIN, MANAGER
- **请求体**: 仓库名称、代码、地址、负责人等信息
- **响应**: 创建成功的仓库信息

**仓库读取接口**
- **URL**: `GET /api/warehouses`
- **权限**: ADMIN, MANAGER, STAFF
- **查询参数**: 搜索关键词、分页参数
- **响应**: 仓库列表和分页信息

**仓库更新接口**
- **URL**: `PUT /api/warehouses/:id`
- **权限**: ADMIN, MANAGER
- **路径参数**: 仓库ID
- **请求体**: 更新的仓库信息

**仓库删除接口**
- **URL**: `DELETE /api/warehouses/:id`
- **权限**: ADMIN
- **路径参数**: 仓库ID
- **注意**: 删除前需要检查是否有库存关联

#### 库存管理核心逻辑

```mermaid
flowchart TD
Start([开始库存操作]) --> Validate[验证输入参数]
Validate --> CheckProduct{产品存在?}
CheckProduct --> |否| Error[返回错误]
CheckProduct --> |是| CheckWarehouse{仓库存在?}
CheckWarehouse --> |否| Error
CheckWarehouse --> |是| EnsureStock[确保库存记录]
EnsureStock --> GetStock[获取当前库存]
GetStock --> Operation{操作类型}
Operation --> |入库| CheckCapacity[检查容量限制]
Operation --> |出库| CheckAvailability[检查可用库存]
Operation --> |转移| CheckTransfer[检查转移条件]
CheckCapacity --> UpdateStock[更新库存数量]
CheckAvailability --> UpdateStock
CheckTransfer --> UpdateStock
UpdateStock --> LogMovement[记录库存移动]
LogMovement --> Commit[提交事务]
Commit --> Success[返回成功]
Error --> End([结束])
Success --> End
```

**图表来源**
- [inventoryRoutes.js:237-437](file://server/src/routes/inventoryRoutes.js#L237-L437)
- [inventoryService.js:30-39](file://server/src/utils/inventoryService.js#L30-L39)

#### 多仓库库存分配

系统支持灵活的多仓库库存分配机制：

**分配流程**
1. 验证产品和仓库归属同一租户
2. 确保库存记录存在
3. 检查可用库存是否足够
4. 更新分配数量
5. 记录分配移动

**释放流程**
1. 验证分配数量不超过已分配数量
2. 减少分配数量
3. 更新库存状态
4. 记录释放移动

#### 仓库间库存转移

```mermaid
sequenceDiagram
participant Client as 客户端
participant API as API接口
participant Service as 业务服务
participant DB as 数据库
participant Audit as 审计日志
Client->>API : POST /api/transfer
API->>Service : 验证转移参数
Service->>DB : 开启事务
DB-->>Service : 事务开始
Service->>DB : 验证源仓库库存
DB-->>Service : 库存充足
Service->>DB : 更新源仓库库存
Service->>DB : 验证目标仓库库存
Service->>DB : 更新目标仓库库存
Service->>DB : 记录转移移动
Service->>DB : 提交事务
DB-->>Service : 事务完成
Service-->>API : 返回转移结果
API-->>Client : 成功响应
Service->>Audit : 写入审计日志
```

**图表来源**
- [inventoryRoutes.js:358-427](file://server/src/routes/inventoryRoutes.js#L358-L427)

### 权限控制与安全

#### 角色权限矩阵

| 角色 | 仓库管理 | 库存操作 | 系统管理 |
|------|----------|----------|----------|
| ADMIN | 全部权限 | 全部权限 | 全部权限 |
| MANAGER | 读取/更新 | 入库/出库 | 有限权限 |
| STAFF | 读取 | 入库/出库 | 无权限 |

#### 租户隔离机制

系统通过以下方式实现租户数据隔离：
1. **JWT令牌验证**: 确保用户属于正确的租户
2. **SQL查询过滤**: 所有查询都包含租户ID条件
3. **中间件拦截**: 在路由处理前验证租户上下文

**章节来源**
- [inventoryRoutes.js:11-11](file://server/src/routes/inventoryRoutes.js#L11-L11)
- [auth.js:35-38](file://server/src/middleware/auth.js#L35-L38)
- [tenant.js:9-14](file://server/src/utils/tenant.js#L9-L14)

## 依赖关系分析

### 组件依赖图

```mermaid
graph TD
subgraph "路由层"
IR[inventoryRoutes.js]
end
subgraph "服务层"
IS[inventoryService.js]
TS[tenant.js]
CA[costAccess.js]
PG[pagination.js]
end
subgraph "中间件层"
AU[auth.js]
AT[auditTrail.js]
end
subgraph "工具层"
AL[auditLog.js]
DB[db.js]
end
subgraph "数据库"
SC[schema.sql]
end
IR --> IS
IR --> AU
IR --> TS
IR --> CA
IR --> PG
AU --> DB
AT --> AL
IS --> DB
TS --> DB
CA --> DB
PG --> DB
DB --> SC
```

**图表来源**
- [inventoryRoutes.js:1-8](file://server/src/routes/inventoryRoutes.js#L1-L8)
- [inventoryService.js:1-46](file://server/src/utils/inventoryService.js#L1-L46)

### 数据流分析

```mermaid
flowchart LR
subgraph "外部请求"
Client[客户端请求]
end
subgraph "认证流程"
Auth[JWT验证]
Role[角色检查]
Tenant[Tenant验证]
end
subgraph "业务处理"
Validation[参数验证]
Business[业务逻辑]
Transaction[数据库事务]
end
subgraph "响应处理"
Audit[Audit日志]
Response[HTTP响应]
end
Client --> Auth
Auth --> Role
Role --> Tenant
Tenant --> Validation
Validation --> Business
Business --> Transaction
Transaction --> Audit
Audit --> Response
```

**图表来源**
- [auth.js:5-61](file://server/src/middleware/auth.js#L5-L61)
- [auditTrail.js:47-81](file://server/src/middleware/auditTrail.js#L47-L81)

**章节来源**
- [inventoryRoutes.js:1-536](file://server/src/routes/inventoryRoutes.js#L1-L536)
- [auditTrail.js:1-86](file://server/src/middleware/auditTrail.js#L1-L86)

## 性能考虑

### 查询优化策略

1. **索引优化**: 为常用查询字段建立索引
   - `stock_levels(product_id, warehouse_id)`
   - `stock_movements(created_at)`
   - `products(category_id)`

2. **分页处理**: 支持大数据量的分页查询
   - 默认每页10条记录
   - 最大支持100条记录/页

3. **批量查询**: 使用Promise.all并行执行查询

### 缓存策略

- **库存缓存**: 高频访问的库存数据可考虑缓存
- **配置缓存**: 系统配置信息可缓存减少数据库查询

### 并发控制

- **事务隔离**: 使用数据库事务确保数据一致性
- **锁机制**: 对关键资源使用适当的锁策略
- **重试机制**: 对并发冲突提供合理的重试策略

## 故障排除指南

### 常见错误及解决方案

**认证失败**
- 检查JWT令牌格式和有效期
- 验证用户账户状态
- 确认租户上下文匹配

**权限不足**
- 确认用户角色是否具备相应权限
- 检查API端点的权限要求
- 验证租户数据隔离设置

**库存操作失败**
- 检查产品和仓库是否存在且属于同一租户
- 验证库存数量是否足够
- 查看事务回滚日志

**数据完整性错误**
- 检查数据库约束条件
- 验证外键关系
- 确认唯一性约束

### 调试工具

1. **审计日志**: 查看所有API调用记录
2. **错误追踪**: 使用统一的错误处理机制
3. **性能监控**: 监控API响应时间和数据库查询

**章节来源**
- [auditTrail.js:47-81](file://server/src/middleware/auditTrail.js#L47-L81)
- [auditLog.js:1-40](file://server/src/utils/auditLog.js#L1-L40)

## 结论

本仓库管理API提供了完整的企业级仓库管理解决方案，具有以下特点：

**技术优势**
- 多租户架构确保数据安全隔离
- 完善的权限控制和审计日志
- 高性能的数据库设计和查询优化
- 可扩展的微服务架构

**业务价值**
- 支持复杂的多仓库库存管理
- 提供灵活的库存分配和转移机制
- 完整的业务流程覆盖
- 用户友好的API设计

**最佳实践建议**
- 始终使用事务处理关键业务操作
- 实施适当的缓存策略提升性能
- 定期备份数据库确保数据安全
- 监控系统性能和错误率

## 附录

### API使用示例

#### 仓库管理示例

**创建仓库**
```javascript
// 前端调用示例
const warehouseData = {
  name: "新仓库",
  code: "WH-NEW",
  address: "新地址",
  managerName: "负责人",
  isActive: true
};

await api.post('/warehouses', warehouseData);
```

**获取仓库列表**
```javascript
// 分页获取仓库列表
const response = await api.get('/warehouses', {
  params: {
    page: 1,
    pageSize: 10,
    search: '仓库名称'
  }
});
```

**更新仓库信息**
```javascript
// 更新特定仓库
await api.put('/warehouses/1', {
  name: "更新后的名称",
  isActive: false
});
```

**删除仓库**
```javascript
// 删除仓库（需确认无库存关联）
await api.delete('/warehouses/1');
```

#### 库存操作示例

**库存入库**
```javascript
const stockInData = {
  productId: 1,
  warehouseId: 1,
  quantity: 100,
  referenceNo: "PO-001",
  notes: "采购入库"
};

await api.post('/api/stock-in', stockInData);
```

**库存出库**
```javascript
const stockOutData = {
  productId: 1,
  warehouseId: 1,
  quantity: 50,
  referenceNo: "SO-001",
  notes: "销售出库"
};

await api.post('/api/stock-out', stockOutData);
```

**仓库间转移**
```javascript
const transferData = {
  productId: 1,
  sourceWarehouseId: 1,
  destinationWarehouseId: 2,
  quantity: 25,
  referenceNo: "TR-001",
  notes: "库存转移"
};

await api.post('/api/transfer', transferData);
```

**库存分配**
```javascript
const allocationData = {
  productId: 1,
  warehouseId: 1,
  quantity: 10,
  mode: "reserve", // 或 "release"
  referenceNo: "AL-001",
  notes: "订单预留"
};

await api.post('/api/allocate', allocationData);
```

### 数据模型参考

**仓库表结构**
- 主键: `id`
- 唯一约束: `code`
- 状态字段: `is_active`
- 时间戳: `created_at`

**库存表结构**
- 复合唯一键: `(product_id, warehouse_id)`
- 数量字段: `quantity`, `allocated_quantity`
- 检查约束: 非负数

**库存移动表结构**
- 枚举字段: `movement_type` (IN, OUT, TRANSFER)
- 外键关系: 关联产品、仓库、用户

**章节来源**
- [schema.sql:22-248](file://server/database/schema.sql#L22-L248)
- [seed.sql:37-42](file://server/database/seed.sql#L37-L42)