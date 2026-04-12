export const roleGuide = [
  {
    role: 'ADMIN',
    title: 'Admin',
    summary: '负责系统配置、主数据治理、库存调整审批和审计追踪。',
    permissions: [
      '查看全部页面和全部提醒',
      '管理分类、仓库、商品和用户账号',
      '发起、完成并应用库存盘点单',
      '查看报表与操作审计日志',
    ],
  },
  {
    role: 'MANAGER',
    title: 'Manager',
    summary: '负责日常仓储运营、库存监控、调拨和盘点执行。',
    permissions: [
      '查看 Dashboard、库存、提醒、盘点单、报表',
      '管理分类、仓库和商品',
      '执行入库、出库、调拨与盘点应用',
      '查看用户列表与审计日志，但不能创建用户',
    ],
  },
  {
    role: 'STAFF',
    title: 'Staff',
    summary: '负责一线收发货和盘点录入，不处理系统级配置。',
    permissions: [
      '查看 Dashboard、库存、提醒和权限说明',
      '执行入库、出库与盘点录入',
      '查看自己可见的库存与低库存提醒',
      '不能管理主数据、报表导出、审计日志和调拨审批',
    ],
  },
]
