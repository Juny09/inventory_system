# Inventory Management System

Full stack inventory management system built with Vue 3, Tailwind CSS, Node.js, Express and PostgreSQL.

## Features

- JWT authentication
- Role based access control for Admin, Manager and Staff
- Product, category and warehouse management
- Inventory tracking by warehouse
- Stock in, stock out and stock transfer flows
- Barcode scanning in the product screen
- Dashboard analytics and reports
- Search + pagination APIs for larger datasets
- CSV / PDF export for reports
- Dashboard charts for movement and stock distribution
- Low stock alert center
- Stock count workflow with apply-difference actions
- Audit logs for key operations
- Role access guide for Admin / Manager / Staff

## Project Structure

```text
inventory_system/
├── server/    # Express API + PostgreSQL schema
├── web/       # Vue 3 + Tailwind dashboard
└── README.md
```

## Quick Start

1. Create a PostgreSQL database named `inventory_system`.
2. Copy `server/.env.example` to `server/.env` and adjust the connection string.
3. Run the schema and seed files:

```bash
psql -d inventory_system -f server/database/schema.sql
psql -d inventory_system -f server/database/seed.sql
```

4. Start the project:

```bash
npm run dev --prefix server
npm run dev --prefix web
```

或者直接：

```bash
npm run dev
```

## Testing Accounts

- Email: `admin@inventory.local`
- Password: `Admin@123`
- Email: `manager@inventory.local`
- Password: `Manager@123`
- Email: `staff@inventory.local`
- Password: `Staff@123`
- Email: `test@inventory.local`
- Password: `Test@123456`

## Login Troubleshooting

- 先确认 PostgreSQL 已启动，并且 `inventory_system` 数据库已执行 schema 和 seed
- 再确认后端已启动：访问 `http://localhost:4000/api/health`
- 然后确认前端已启动：访问 `http://localhost:5173/login`
- 登录页如果显示“后端服务正常，可直接登录”，说明前后端已经打通
