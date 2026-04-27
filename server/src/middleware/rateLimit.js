const buckets = new Map()

function getClientKey(req) {
  const forwardedFor = req.headers['x-forwarded-for']
  const sourceIp = String(forwardedFor || req.ip || 'unknown').split(',')[0].trim()
  return sourceIp || 'unknown'
}

function createRateLimiter({ windowMs = 60 * 1000, max = 30, namespace = 'default' } = {}) {
  return (req, res, next) => {
    const now = Date.now()
    const key = `${namespace}:${getClientKey(req)}`
    const current = buckets.get(key)

    if (!current || current.expiresAt <= now) {
      buckets.set(key, {
        count: 1,
        expiresAt: now + windowMs,
      })
      return next()
    }

    if (current.count >= max) {
      const retryAfterSec = Math.ceil((current.expiresAt - now) / 1000)
      res.setHeader('retry-after', String(Math.max(retryAfterSec, 1)))
      return res.fail
        ? res.fail('RATE_LIMITED', 'Too many requests. Please retry later.', { retryAfterSec }, 429)
        : res.status(429).json({ message: 'Too many requests. Please retry later.' })
    }

    current.count += 1
    buckets.set(key, current)
    return next()
  }
}

module.exports = {
  createRateLimiter,
}
