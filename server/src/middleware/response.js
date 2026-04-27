const { randomUUID } = require('crypto')

function responseMiddleware(req, res, next) {
  const requestId = randomUUID()
  req.requestId = requestId
  res.setHeader('x-request-id', requestId)
  const originalJson = res.json.bind(res)

  res.json = function json(payload) {
    if (payload && typeof payload === 'object' && typeof payload.success === 'boolean') {
      return originalJson(payload)
    }

    if (res.statusCode >= 400) {
      const message = payload?.message || 'Request failed.'
      const code = payload?.code || 'REQUEST_FAILED'
      const details = payload?.details ?? {
        ...(payload?.error ? { error: payload.error } : {}),
      }
      return originalJson({
        success: false,
        code,
        message,
        details,
        requestId,
      })
    }

    return originalJson({
      success: true,
      data: payload,
      requestId,
    })
  }

  res.success = function success(data, statusCode = 200) {
    res.status(statusCode)
    return originalJson({
      success: true,
      data,
      requestId,
    })
  }

  res.fail = function fail(code, message, details = null, statusCode = 400) {
    res.status(statusCode)
    return originalJson({
      success: false,
      code,
      message,
      details,
      requestId,
    })
  }

  next()
}

module.exports = {
  responseMiddleware,
}
