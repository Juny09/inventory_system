// 统一处理分页参数，避免每个接口重复写同样逻辑
function getPaginationParams(query = {}) {
  const page = Math.max(Number(query.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 10, 1), 100)
  const offset = (page - 1) * pageSize

  return {
    page,
    pageSize,
    offset,
  }
}

// 统一返回分页结构，前端表格可以直接复用
function buildPagination(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

module.exports = {
  getPaginationParams,
  buildPagination,
}
