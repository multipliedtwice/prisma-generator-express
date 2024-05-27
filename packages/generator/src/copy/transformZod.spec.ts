import { z, ZodError } from 'zod'
import { allow, flattenObject, forbid } from './transformZod'

describe('Cryptocurrency Schema Validation', () => {
  const cryptoSchema = z.object({
    transactions: z
      .array(
        z.object({
          amount: z.number(),
          currency: z.string(),
          date: z.string().optional(),
          details: z
            .object({
              fee: z.number().optional(),
              type: z.string(),
            })
            .optional(),
        }),
      )
      .optional(),
    wallet: z.object({
      id: z.string(),
      owner: z.object({
        name: z.string(),
        age: z.number().optional(),
      }),
    }),
  })

  const allowedFields = [
    'wallet.id',
    'wallet.owner.name',
    'transactions[].amount',
    'transactions[].currency',
  ]
  const forbiddenFields = ['wallet.owner.age', 'transactions.details.fee']

  describe('Allow Function', () => {
    it('should validate data with only allowed fields', () => {
      const inputData = {
        transactions: [
          {
            amount: 100,
            currency: 'BTC',
          },
        ],
        wallet: {
          id: 'wallet123',
          owner: {
            name: 'Alice',
          },
        },
      }

      try {
        const result = allow(cryptoSchema, allowedFields).safeParse(inputData)

        expect(result.success).toBe(true)
      } catch (error) {
        throw error
      }
    })

    it('should return an error for data with disallowed fields', () => {
      const inputData = {
        transactions: [
          {
            amount: 100,
            currency: 'BTC',
            details: {
              fee: 0.01,
              type: 'transfer',
            },
          },
        ],
        wallet: {
          id: 'wallet123',
          owner: {
            name: 'Alice',
            age: 30,
          },
        },
      }

      try {
        const result = allow(cryptoSchema, allowedFields).safeParse(inputData)

        expect(result.success).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
      }
    })
  })

  describe('Forbid Function', () => {
    it('should successfully parse when forbidden fields are absent', () => {
      const inputData = {
        transactions: [
          {
            amount: 200,
            currency: 'ETH',
          },
        ],
        wallet: {
          id: 'wallet456',
          owner: {
            name: 'Bob',
          },
        },
      }

      try {
        const result = forbid(cryptoSchema, forbiddenFields).safeParse(
          inputData,
        )

        expect(result.success).toBe(true)
      } catch (error) {
        throw error
      }
    })

    it('should return an error when forbidden fields are present', () => {
      const inputData = {
        transactions: [
          {
            amount: 200,
            currency: 'ETH',
            details: {
              fee: 0.02,
              type: 'exchange',
            },
          },
        ],
        wallet: {
          id: 'wallet456',
          owner: {
            name: 'Bob',
            age: 40,
          },
        },
      }

      try {
        const result = forbid(cryptoSchema, forbiddenFields).safeParse(
          inputData,
        )

        expect(result.success).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
      }
    })
  })

  it('should handle deeply nested structures correctly', () => {
    const inputData = {
      transactions: [
        {
          amount: 300,
          currency: 'XRP',
          details: {
            fee: 0.03,
            type: 'purchase',
          },
        },
      ],
      wallet: {
        id: 'wallet789',
        owner: {
          name: 'Charlie',
          age: 50,
        },
      },
    }

    try {
      const result = forbid(cryptoSchema, forbiddenFields).safeParse(inputData)
      expect(result.success).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
    }
  })

  it('should not error for absent optional fields', () => {
    const inputData = {
      transactions: [],
      wallet: {
        id: 'wallet012',
        owner: {
          name: 'Dave',
        },
      },
    }

    try {
      const result = allow(cryptoSchema, allowedFields).safeParse(inputData)
      expect(result.success).toBe(true)
    } catch (error) {
      throw error
    }
  })

  it('should flag all fields when all are forbidden', () => {
    const inputData = {
      transactions: [
        {
          amount: 400,
          currency: 'LTC',
          details: {
            fee: 0.04,
            type: 'withdrawal',
          },
        },
      ],
      wallet: {
        id: 'wallet345',
        owner: {
          name: 'Eve',
          age: 60,
        },
      },
    }
    const allForbidden = [
      'wallet.id',
      'wallet.owner.name',
      'wallet.owner.age',
      'transactions[].amount',
      'transactions[].currency',
      'transactions[].details.fee',
    ]

    try {
      const result = forbid(cryptoSchema, allForbidden).safeParse(inputData)
      expect(result.success).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
    }
  })

  it('should handle combination of allowed and forbidden correctly', () => {
    const inputData = {
      transactions: [
        {
          amount: 500,
          currency: 'ADA',
          details: {
            fee: 0.05,
            type: 'deposit',
          },
        },
      ],
      wallet: {
        id: 'wallet678',
        owner: {
          name: 'Frank',
          age: 70,
        },
      },
    }

    try {
      const resultAllow = allow(cryptoSchema, [
        'wallet.owner.name',
        'transactions.currency',
      ]).safeParse(inputData)
      expect(resultAllow.success).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
    }

    try {
      const resultForbid = forbid(cryptoSchema, forbiddenFields).safeParse(
        inputData,
      )

      expect(resultForbid.success).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
    }
  })

  describe('Additional Cryptocurrency Schema Validation', () => {
    it('should return an error for invalid input types', () => {
      const inputData = {
        transactions: [
          {
            amount: '100', // Invalid type: should be a number
            currency: 'BTC',
          },
        ],
        wallet: {
          id: 123, // Invalid type: should be a string
          owner: {
            name: 'Alice',
          },
        },
      }

      try {
        const result = allow(cryptoSchema, allowedFields).safeParse(inputData)
        expect(result.success).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
      }
    })

    it('should handle deeply nested arrays correctly', () => {
      const inputData = {
        transactions: [
          {
            amount: 300,
            currency: 'XRP',
            details: {
              fee: 0.03,
              type: 'purchase',
            },
          },
        ],
        wallet: {
          id: 'wallet789',
          owner: {
            name: 'Charlie',
            age: 50,
          },
        },
      }

      try {
        const result = forbid(cryptoSchema, forbiddenFields).safeParse(
          inputData,
        )

        expect(result.success).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
      }
    })

    it('should correctly handle mixed allowed and forbidden paths', () => {
      const inputData = {
        transactions: [
          {
            amount: 200,
            currency: 'ETH',
            details: {
              fee: 0.02,
              type: 'exchange',
            },
          },
        ],
        wallet: {
          id: 'wallet456',
          owner: {
            name: 'Bob',
            age: 40,
          },
        },
      }

      try {
        const resultAllow = allow(cryptoSchema, [
          'wallet.owner.name',
        ]).safeParse(inputData)

        expect(resultAllow.success).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
      }

      try {
        const resultForbid = forbid(cryptoSchema, [
          'wallet.owner.age',
        ]).safeParse(inputData)

        expect(resultForbid.success).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
      }
    })

    it('should handle empty input objects gracefully', () => {
      const optionalCryptoSchema = z.object({
        transactions: z
          .array(
            z.object({
              amount: z.number().optional(),
              currency: z.string().optional(),
              date: z.string().optional(),
              details: z
                .object({
                  fee: z.number().optional(),
                  type: z.string().optional(),
                })
                .optional(),
            }),
          )
          .optional(),
        wallet: z
          .object({
            id: z.string().optional(),
            owner: z
              .object({
                name: z.string().optional(),
                age: z.number().optional(),
              })
              .optional(),
          })
          .optional(),
      })

      const inputData = {}

      try {
        const result = allow(optionalCryptoSchema, allowedFields).safeParse(
          inputData,
        )
        expect(result.success).toBe(true)
      } catch (error) {
        console.error(
          'Error in empty input objects test:',
          JSON.stringify(error, null, 2),
        )
        throw error
      }
    })

    it('should handle edge cases correctly', () => {
      const inputData = {
        transactions: [
          {
            amount: null,
            currency: undefined,
          },
        ],
        wallet: {
          id: 'walletEdge',
          owner: {
            name: null,
            age: undefined,
          },
        },
      }

      try {
        const result = forbid(cryptoSchema, forbiddenFields).safeParse(
          inputData,
        )
        expect(result.success).toBe(false)
      } catch (error) {
        console.error(
          'Error in edge cases test:',
          JSON.stringify(error, null, 2),
        )
        expect(error).toBeInstanceOf(ZodError)
      }
    })
  })

  it('should skip keys with undefined values in optional fields', () => {
    const inputData = {
      wallet: {
        owner: {
          age: undefined, // Optional key with undefined value
        },
      },
    }

    const schema = z.object({
      wallet: z.object({
        owner: z.object({
          age: z.number().optional(),
        }),
      }),
    })

    const result = flattenObject(inputData, '', schema)
    expect(result).toEqual({})
  })

  it('should handle deeply nested objects correctly', () => {
    const inputData = {
      wallet: {
        owner: {
          details: {
            address: {
              city: 'New York',
            },
          },
        },
      },
    }

    const schema = z.object({
      wallet: z.object({
        owner: z.object({
          details: z.object({
            address: z.object({
              city: z.string(),
            }),
          }),
        }),
      }),
    })

    const result = flattenObject(inputData, '', schema)
    expect(result).toEqual({
      'wallet.owner.details.address.city': 'New York',
    })
  })

  it('should add key-value pairs to the result object', () => {
    const inputData = {
      wallet: {
        id: 'wallet123',
      },
    }

    const schema = z.object({
      wallet: z.object({
        id: z.string(),
      }),
    })

    const result = flattenObject(inputData, '', schema)
    expect(result).toEqual({
      'wallet.id': 'wallet123',
    })
  })

  it('should handle ZodUnion with ZodLazy correctly', () => {
    const lazySchema = z.lazy(() => z.string())
    const unionSchema = z.union([lazySchema, z.number()])

    const inputData = {
      wallet: {
        details: 'lazy value',
      },
    }

    const schema = z.object({
      wallet: z.object({
        details: unionSchema,
      }),
    })

    try {
      const result = flattenObject(inputData, '', schema)
      expect(result).toEqual({
        'wallet.details': 'lazy value',
      })
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
    }
  })

  it('deep nesting', () => {
    const taskSchema = z.object({
      select: z
        .object({
          id: z.boolean().optional(),
          project_id: z.boolean().optional(),
          list_id: z.boolean().optional(),
          user_assignments: z
            .object({
              select: z.object({
                user: z.boolean().optional(),
              }),
            })
            .optional(),
          tags_mappings: z
            .object({
              select: z.object({
                tag: z.boolean().optional(),
              }),
            })
            .optional(),
          attachments: z
            .object({
              select: z.object({
                attachment: z.boolean().optional(),
              }),
              where: z
                .object({
                  is_image: z.boolean().optional(),
                })
                .optional(),
              take: z.number().optional(),
              orderBy: z
                .object({
                  created_at: z.enum(['asc', 'desc']).optional(),
                })
                .optional(),
            })
            .optional(),
          rendered_description: z.boolean().optional(),
          description: z.boolean().optional(),
          created_at: z.boolean().optional(),
          start_date: z.boolean().optional(),
          reactions: z.boolean().optional(),
          intervals: z.boolean().optional(),
          column_id: z.boolean().optional(),
          priority: z.boolean().optional(),
          due_date: z.boolean().optional(),
          column: z.boolean().optional(),
          title: z.boolean().optional(),
          order: z.boolean().optional(),
          color: z.boolean().optional(),
        })
        .optional(),
      where: z
        .object({
          id: z.string().optional(),
          AND: z
            .array(
              z.object({
                OR: z
                  .array(
                    z.object({
                      to_delete: z.boolean().nullable().optional(),
                    }),
                  )
                  .optional(),
              }),
            )
            .optional(),
        })
        .optional(),
    })

    const allowedFields = [
      'select.id',
      'select.project_id',
      'select.list_id',
      'select.user_assignments.select.user',
      'select.tags_mappings.select.tag',
      'select.attachments.select.attachment',
      'select.attachments.where.is_image',
      'select.attachments.take',
      'select.attachments.orderBy.created_at',
      'select.rendered_description',
      'select.description',
      'select.created_at',
      'select.start_date',
      'select.reactions',
      'select.intervals',
      'select.column_id',
      'select.priority',
      'select.due_date',
      'select.column',
      'select.order',
      'select.color',
      'where.id',
      'where.AND[].OR[].to_delete',
    ]
    const inputData = {
      select: {
        id: true,
        project_id: true,
        list_id: true,
        user_assignments: {
          select: {
            user: true,
          },
        },
        tags_mappings: {
          select: {
            tag: true,
          },
        },
        attachments: {
          select: {
            attachment: true,
          },
          where: {
            is_image: true,
          },
          take: 100,
          orderBy: {
            created_at: 'desc',
          },
        },
        rendered_description: true,
        description: true,
        created_at: true,
        start_date: true,
        reactions: true,
        intervals: true,
        column_id: true,
        priority: true,
        due_date: true,
        column: true,
        title: true,
        order: true,
        color: true,
      },
      where: {
        id: 'task_id',
        AND: [
          {
            OR: [{ to_delete: false }, { to_delete: null }],
          },
        ],
      },
    }

    try {
      const result = allow(taskSchema, allowedFields).safeParse(inputData)
      expect(result.success).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
    }
  })
})
