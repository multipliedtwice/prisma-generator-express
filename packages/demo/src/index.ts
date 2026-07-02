/**
 * Wiring only.
 *
 * All route configs live under src/models/. This file:
 *   1. builds the extended Prisma client
 *   2. attaches it and the postgres connector to every request
 *   3. runs the auth/context middleware
 *   4. mounts each generated router
 *   5. mounts per-model docs under /docs/{modelname}
 *   6. mounts the combined /docs index
 *   7. prints a demo cheatsheet on startup
 */
import 'dotenv/config'
import express from 'express'
import type { Request, RequestHandler } from 'express'
import postgres from 'postgres'

import { createPrismaClient } from './prisma'
import { contextMiddleware } from './context'

import { ShopRouter } from '../prisma/generated/express/Shop/ShopRouter'
import { UserRouter } from '../prisma/generated/express/User/UserRouter'
import { CustomerRouter } from '../prisma/generated/express/Customer/CustomerRouter'
import { ProductRouter } from '../prisma/generated/express/Product/ProductRouter'
import { OrderRouter } from '../prisma/generated/express/Order/OrderRouter'
import { OrderLineRouter } from '../prisma/generated/express/OrderLine/OrderLineRouter'

import { ShopDocs } from '../prisma/generated/express/Shop/ShopDocs'
import { UserDocs } from '../prisma/generated/express/User/UserDocs'
import { CustomerDocs } from '../prisma/generated/express/Customer/CustomerDocs'
import { ProductDocs } from '../prisma/generated/express/Product/ProductDocs'
import { OrderDocs } from '../prisma/generated/express/Order/OrderDocs'
import { OrderLineDocs } from '../prisma/generated/express/OrderLine/OrderLineDocs'

import { registerUnifiedDocs } from '../prisma/generated/express/combinedDocs'

import { shopConfig } from './models/shop/config'
import { userConfig } from './models/user/config'
import { customerConfig } from './models/customer/config'
import { productConfig } from './models/product/config'
import { orderConfig } from './models/order/config'
import { orderLineConfig } from './models/orderLine/config'

const prisma = createPrismaClient()
const sql = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL) : null

const attachPrisma: RequestHandler = (req, _res, next) => {
  req.prisma = prisma
  if (sql) req.postgres = sql
  next()
}

const app = express()

app.use(express.json())
app.use(contextMiddleware)
app.use(attachPrisma)

app.use('/', ShopRouter(shopConfig))
app.use('/', UserRouter(userConfig))
app.use('/', CustomerRouter(customerConfig))
app.use('/', ProductRouter(productConfig))
app.use('/', OrderRouter(orderConfig))
app.use('/', OrderLineRouter(orderLineConfig))

app.get('/docs/shop', ShopDocs())
app.get('/docs/user', UserDocs())
app.get('/docs/customer', CustomerDocs())
app.get('/docs/product', ProductDocs())
app.get('/docs/order', OrderDocs())
app.get('/docs/orderline', OrderLineDocs())

registerUnifiedDocs(app, { title: 'Demo Shop Platform API' })

app.use(
  (
    err: unknown,
    _req: Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const e = err as { status?: number; message?: string }
    const status = typeof e?.status === 'number' ? e.status : 500
    const message = e?.message || 'Internal server error'
    if (res.headersSent) return
    res.status(status).json({ message })
  },
)

const port = Number(process.env.PORT) || 3000

app.listen(port, () => {
  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Demo Shop Platform — http://localhost:' + port)
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log('  Stack:')
  console.log('    prisma-generator-express  routers + OpenAPI + docs')
  console.log('    prisma-guard              @scope-root Shop, variants, enforceProjection')
  console.log('    prisma-sql                SQL speed extension (' + (sql ? 'ACTIVE' : 'inactive: no DATABASE_URL') + ')')
  console.log('    prisma-query-builder-ui   visual playground')
  console.log('')
  console.log('  Docs:        http://localhost:' + port + '/docs')
  console.log('  Playground:  http://localhost:' + port + '/docs/product?ui=playground')
  console.log('')
  console.log('  Auth tokens (x-auth-token):')
  console.log('    owner-acme       shop-acme,   OWNER')
  console.log('    admin-acme       shop-acme,   ADMIN')
  console.log('    member-acme      shop-acme,   MEMBER')
  console.log('    owner-globex     shop-globex, OWNER    (proves tenant isolation)')
  console.log('')
  console.log('  Sample calls (all reads require x-api-variant):')
  console.log('')
  console.log('    curl -H "x-auth-token: owner-acme" -H "x-api-variant: owner" \\')
  console.log('      http://localhost:' + port + '/api/v1/product')
  console.log('')
  console.log('    curl -H "x-auth-token: member-acme" -H "x-api-variant: member" \\')
  console.log('      http://localhost:' + port + '/api/v1/product')
  console.log('')
  console.log('    curl -X POST -H "x-auth-token: owner-acme" -H "x-api-variant: owner" \\')
  console.log('      -H "content-type: application/json" \\')
  console.log('      -d \'{"where":{"category":{"equals":"HARDWARE"}}}\' \\')
  console.log('      http://localhost:' + port + '/api/v1/product/read')
  console.log('')
  console.log('    curl -X POST -H "x-auth-token: owner-acme" -H "x-api-variant: owner" \\')
  console.log('      -H "content-type: application/json" \\')
  console.log('      -d \'{"data":{"email":"new@acme.example","passwordHash":"h","role":"MEMBER"}}\' \\')
  console.log('      http://localhost:' + port + '/user')
  console.log('')
  console.log('    curl -X POST -H "x-auth-token: owner-acme" -H "x-api-variant: owner" \\')
  console.log('      -H "content-type: application/json" \\')
  console.log('      -d \'{"data":[{"name":"A","price":"9.99","category":"DIGITAL","isPublished":true}]}\' \\')
  console.log('      http://localhost:' + port + '/api/v1/product/many')
  console.log('')
  console.log('    # Manual progressive SSE — Order dashboard')
  console.log('    curl -N -H "x-auth-token: owner-acme" \\')
  console.log('      -H "Accept: text/event-stream" -H "x-api-variant: dashboard" \\')
  console.log('      http://localhost:' + port + '/order')
  console.log('')
  console.log('    # Auto-include SSE — OrderLine detail (no guard shape)')
  console.log('    curl -N -H "x-auth-token: owner-acme" \\')
  console.log('      -H "Accept: text/event-stream" -H "x-api-variant: detail" \\')
  console.log('      "http://localhost:' + port + '/orderline?include=%7B%22order%22%3Atrue%2C%22product%22%3Atrue%7D"')
  console.log('')
  console.log('    # updateEach — opt-in, requireOwnerRole hook')
  console.log('    curl -X POST -H "x-auth-token: owner-acme" \\')
  console.log('      -H "content-type: application/json" \\')
  console.log('      -d \'[{"where":{"id":"u-member-acme"},"data":{"isActive":false}}]\' \\')
  console.log('      http://localhost:' + port + '/user/each')
  console.log('')
  console.log('    # Tenant isolation — globex sees zero acme products')
  console.log('    curl -H "x-auth-token: owner-globex" -H "x-api-variant: owner" \\')
  console.log('      http://localhost:' + port + '/api/v1/product')
  console.log('')
  console.log('  Skipped:')
  console.log('    audit_log   /// generator off')
  console.log('')
})