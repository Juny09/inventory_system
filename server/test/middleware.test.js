const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const request = require('supertest')

const { responseMiddleware } = require('../src/middleware/response')
const { createRateLimiter } = require('../src/middleware/rateLimit')

test('response middleware wraps success payload', async () => {
  const app = express()
  app.use(express.json())
  app.use(responseMiddleware)
  app.get('/ok', (_req, res) => res.json({ hello: 'world' }))

  const res = await request(app).get('/ok')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.success, true)
  assert.deepEqual(res.body.data, { hello: 'world' })
  assert.ok(res.body.requestId)
  assert.ok(res.headers['x-request-id'])
})

test('response middleware wraps error payload', async () => {
  const app = express()
  app.use(express.json())
  app.use(responseMiddleware)
  app.get('/bad', (_req, res) => res.status(400).json({ message: 'Bad request.' }))

  const res = await request(app).get('/bad')
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.success, false)
  assert.equal(res.body.message, 'Bad request.')
  assert.ok(res.body.code)
  assert.ok(res.body.requestId)
})

test('rate limiter blocks after max', async () => {
  const app = express()
  app.use(express.json())
  app.use(responseMiddleware)
  app.use(createRateLimiter({ namespace: 'test', windowMs: 60 * 1000, max: 2 }))
  app.get('/limited', (_req, res) => res.json({ ok: true }))

  await request(app).get('/limited').expect(200)
  await request(app).get('/limited').expect(200)
  const res = await request(app).get('/limited')
  assert.equal(res.statusCode, 429)
  assert.equal(res.body.success, false)
  assert.equal(res.body.code, 'RATE_LIMITED')
})

