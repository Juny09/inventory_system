const jwt = require('jsonwebtoken')

const COST_ACCESS_HEADER = 'x-cost-access-token'

function getCostAccessToken(req) {
  const token = req.headers[COST_ACCESS_HEADER]

  if (!token || !['ADMIN', 'MANAGER'].includes(req.user?.role)) {
    return null
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    if (payload.purpose !== 'cost-access' || payload.userId !== req.user.id) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function canViewCost(req) {
  return Boolean(getCostAccessToken(req))
}

module.exports = {
  canViewCost,
}
