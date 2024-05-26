import { parseQueryParams } from './parseQueryParams'

describe('parseQueryParams', () => {
  it('should parse basic field selection correctly', () => {
    const params = {
      select: {
        id: 'true',
        name: 'true',
      },
    }
    const result = parseQueryParams(params)
    expect(result).toEqual({
      select: {
        id: true,
        name: true,
      },
    })
  })

  it('should parse nested field selection correctly', () => {
    const params = {
      select: {
        user: {
          select: {
            profile: 'true',
          },
        },
      },
    }
    const result = parseQueryParams(params)
    expect(result).toEqual({
      select: {
        user: {
          select: {
            profile: true,
          },
        },
      },
    })
  })

  it('should handle deeply nested logical operators correctly', () => {
    const params = {
      where: {
        AND: [
          { id: '123' },
          {
            OR: [{ active: 'true' }, { active: 'false' }],
          },
        ],
      },
    }
    const result = parseQueryParams(params)
    expect(result).toEqual({
      where: {
        AND: [
          { id: 123 },
          {
            OR: [{ active: true }, { active: false }],
          },
        ],
      },
    })
  })

  it('should handle complex nested arrays correctly', () => {
    const params = {
      where: {
        id: 'Vxdu42',
        AND: [
          {
            OR: [{ to_delete: 'false' }, { to_delete: 'null' }],
          },
        ],
      },
    }
    const result = parseQueryParams(params)
    expect(result).toEqual({
      where: {
        id: 'Vxdu42',
        AND: [
          {
            OR: [{ to_delete: false }, { to_delete: null }],
          },
        ],
      },
    })
  })

  it('should handle mixed types and conditions', () => {
    const params = {
      select: {
        id: 'true',
        project_id: 'true',
        user_assignments: {
          select: {
            user: 'true',
          },
        },
        tags_mappings: {
          select: {
            tag: 'true',
          },
        },
        attachments: {
          select: {
            attachment: 'true',
          },
          where: {
            is_image: 'true',
          },
          take: '100',
          orderBy: {
            created_at: 'desc',
          },
        },
      },
      where: {
        id: 'Vxdu42',
        AND: [
          {
            OR: [{ to_delete: 'false' }, { to_delete: 'null' }],
          },
        ],
      },
    }
    const result = parseQueryParams(params)
    expect(result).toEqual({
      select: {
        id: true,
        project_id: true,
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
      },
      where: {
        id: 'Vxdu42',
        AND: [
          {
            OR: [{ to_delete: false }, { to_delete: null }],
          },
        ],
      },
    })
  })

  it('should handle special cases correctly', () => {
    const params = {
      emptyObject: {},
      emptyArray: [],
      unexpectedType: '123',
    }
    const result = parseQueryParams(params)
    expect(result).toEqual({
      emptyObject: {},
      emptyArray: [],
      unexpectedType: 123,
    })
  })

  it('should parse string values correctly', () => {
    expect(parseQueryParams('true')).toBe(true)
    expect(parseQueryParams('false')).toBe(false)
    expect(parseQueryParams('null')).toBe(null)
    expect(parseQueryParams('123')).toBe(123)
    expect(parseQueryParams('test')).toBe('test')
  })
})
