export const roleGuide = [
  {
    role: 'ADMIN',
    title: 'Admin',
    summaryEn: 'Responsible for system settings, master data governance, stock adjustment approvals, and audit tracking.',
    summaryCn: '负责系统配置、主数据治理、库存调整审批和审计追踪。',
    permissions: [
      {
        en: 'Access all pages and alerts',
        cn: '查看全部页面和全部提醒',
      },
      {
        en: 'Manage categories, warehouses, products and users',
        cn: '管理分类、仓库、商品和用户账号',
      },
      {
        en: 'Create, complete and apply stock counts',
        cn: '发起、完成并应用库存盘点单',
      },
      {
        en: 'Review reports and audit logs',
        cn: '查看报表与操作审计日志',
      },
    ],
  },
  {
    role: 'MANAGER',
    title: 'Manager',
    summaryEn: 'Responsible for daily warehouse operations, inventory monitoring, transfer, and stock count execution.',
    summaryCn: '负责日常仓储运营、库存监控、调拨和盘点执行。',
    permissions: [
      {
        en: 'View dashboard, inventory, alerts, stock counts and reports',
        cn: '查看 Dashboard、库存、提醒、盘点单、报表',
      },
      {
        en: 'Manage categories, warehouses and products',
        cn: '管理分类、仓库和商品',
      },
      {
        en: 'Execute stock in, stock out, transfer and apply stock counts',
        cn: '执行入库、出库、调拨与盘点应用',
      },
      {
        en: 'View users and audit logs but cannot create users',
        cn: '查看用户列表与审计日志，但不能创建用户',
      },
    ],
  },
  {
    role: 'STAFF',
    title: 'Staff',
    summaryEn: 'Responsible for frontline receiving/shipping and stock count input, without system-level configuration.',
    summaryCn: '负责一线收发货和盘点录入，不处理系统级配置。',
    permissions: [
      {
        en: 'View dashboard, inventory, alerts and access guide',
        cn: '查看 Dashboard、库存、提醒和权限说明',
      },
      {
        en: 'Execute stock in, stock out and stock count input',
        cn: '执行入库、出库与盘点录入',
      },
      {
        en: 'View assigned stock and low-stock alerts',
        cn: '查看自己可见的库存与低库存提醒',
      },
      {
        en: 'Cannot manage master data, export reports, view audit logs or approve transfers',
        cn: '不能管理主数据、报表导出、审计日志和调拨审批',
      },
    ],
  },
]
