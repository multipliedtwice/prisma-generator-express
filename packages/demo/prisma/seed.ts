import { PrismaClient } from './generated/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.orderLine.deleteMany()
  await prisma.order.deleteMany()
  await prisma.product.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.user.deleteMany()
  await prisma.shop.deleteMany()

  const acme = await prisma.shop.create({
    data: {
      id: 'shop-acme',
      name: 'Acme Supplies',
      slug: 'acme',
    },
  })

  const globex = await prisma.shop.create({
    data: {
      id: 'shop-globex',
      name: 'Globex Digital',
      slug: 'globex',
    },
  })

  for (const shop of [acme, globex]) {
    await prisma.user.createMany({
      data: [
        {
          id: 'u-owner-' + shop.slug,
          shopId: shop.id,
          email: 'owner@' + shop.slug + '.example',
          passwordHash: 'hashed-owner-secret',
          role: 'OWNER',
          isActive: true,
        },
        {
          id: 'u-admin-' + shop.slug,
          shopId: shop.id,
          email: 'admin@' + shop.slug + '.example',
          passwordHash: 'hashed-admin-secret',
          role: 'ADMIN',
          isActive: true,
        },
        {
          id: 'u-member-' + shop.slug,
          shopId: shop.id,
          email: 'member@' + shop.slug + '.example',
          passwordHash: 'hashed-member-secret',
          role: 'MEMBER',
          isActive: true,
        },
      ],
    })

    const customers = await Promise.all(
      Array.from({ length: 5 }).map((_, i) =>
        prisma.customer.create({
          data: {
            shopId: shop.id,
            email: 'customer' + (i + 1) + '@' + shop.slug + '.example',
            fullName: 'Customer ' + (i + 1) + ' of ' + shop.name,
          },
        }),
      ),
    )

    const categories: Array<'APPAREL' | 'HARDWARE' | 'DIGITAL'> = [
      'APPAREL',
      'HARDWARE',
      'DIGITAL',
    ]

    const products = await Promise.all(
      Array.from({ length: 20 }).map((_, i) =>
        prisma.product.create({
          data: {
            shopId: shop.id,
            name: shop.name + ' Product ' + (i + 1),
            price: (9.99 + i).toFixed(2),
            category: categories[i % categories.length],
            isPublished: i % 3 !== 0,
          },
        }),
      ),
    )

    for (let i = 0; i < 15; i++) {
      const customer = customers[i % customers.length]
      const productA = products[i % products.length]
      const productB = products[(i + 3) % products.length]
      const qtyA = 1 + (i % 3)
      const qtyB = 1 + ((i + 1) % 2)
      const totalCents = BigInt(
        Math.round(Number(productA.price) * qtyA * 100) +
          Math.round(Number(productB.price) * qtyB * 100),
      )

      await prisma.order.create({
        data: {
          shopId: shop.id,
          customerId: customer.id,
          status: (['PENDING', 'PAID', 'SHIPPED'] as const)[i % 3],
          totalCents,
          lines: {
            create: [
              {
                productId: productA.id,
                quantity: qtyA,
                unitPriceCents: BigInt(
                  Math.round(Number(productA.price) * 100),
                ),
              },
              {
                productId: productB.id,
                quantity: qtyB,
                unitPriceCents: BigInt(
                  Math.round(Number(productB.price) * 100),
                ),
              },
            ],
          },
        },
      })
    }
  }

  console.log('Seed complete.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())