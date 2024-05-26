import { encodeQueryParams } from './encodeQueryParams'

describe('Query Params Encoding', () => {
  it('should encode simple key-value pairs correctly', () => {
    const params = {
      id: 1,
      name: 'test',
    }
    const result = encodeQueryParams(params)
    expect(result).toBe('id=1&name=test')
  })

  it('should encode nested objects correctly', () => {
    const params = {
      select: {
        id: true,
        name: true,
      },
    }
    const result = encodeQueryParams(params)
    expect(result).toBe('select%5Bid%5D=true&select%5Bname%5D=true')
  })

  it('should encode arrays correctly', () => {
    const params = {
      ids: [1, 2, 3],
    }
    const result = encodeQueryParams(params)
    expect(result).toBe('ids%5B0%5D=1&ids%5B1%5D=2&ids%5B2%5D=3')
  })

  it('should encode complex nested objects correctly', () => {
    const params = {
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
    const result = encodeQueryParams(params)
    expect(result).toBe(
      'select%5Bid%5D=true&select%5Bproject_id%5D=true&select%5Blist_id%5D=true&select%5Buser_assignments%5D%5Bselect%5D%5Buser%5D=true&select%5Btags_mappings%5D%5Bselect%5D%5Btag%5D=true&select%5Battachments%5D%5Bselect%5D%5Battachment%5D=true&select%5Battachments%5D%5Bwhere%5D%5Bis_image%5D=true&select%5Battachments%5D%5Btake%5D=100&select%5Battachments%5D%5BorderBy%5D%5Bcreated_at%5D=desc&select%5Brendered_description%5D=true&select%5Bdescription%5D=true&select%5Bcreated_at%5D=true&select%5Bstart_date%5D=true&select%5Breactions%5D=true&select%5Bintervals%5D=true&select%5Bcolumn_id%5D=true&select%5Bpriority%5D=true&select%5Bdue_date%5D=true&select%5Bcolumn%5D=true&select%5Btitle%5D=true&select%5Border%5D=true&select%5Bcolor%5D=true&where%5Bid%5D=task_id&where%5BAND%5D%5B0%5D%5BOR%5D%5B0%5D%5Bto_delete%5D=false&where%5BAND%5D%5B0%5D%5BOR%5D%5B1%5D%5Bto_delete%5D=null',
    )
  })

  it('should handle empty objects correctly', () => {
    const params = {}
    const result = encodeQueryParams(params)
    expect(result).toBe('')
  })

  it('should handle null values correctly', () => {
    const params = {
      id: null,
      name: 'test',
    }
    const result = encodeQueryParams(params)
    expect(result).toBe('id=null&name=test')
  })

  it('should handle boolean values correctly', () => {
    const params = {
      isActive: true,
      isDeleted: false,
    }
    const result = encodeQueryParams(params)
    expect(result).toBe('isActive=true&isDeleted=false')
  })

  it('should handle nested arrays correctly', () => {
    const params = {
      filters: [
        {
          key: 'age',
          values: [20, 30, 40],
        },
      ],
    }
    const result = encodeQueryParams(params)
    expect(result).toBe(
      'filters%5B0%5D%5Bkey%5D=age&filters%5B0%5D%5Bvalues%5D%5B0%5D=20&filters%5B0%5D%5Bvalues%5D%5B1%5D=30&filters%5B0%5D%5Bvalues%5D%5B2%5D=40',
    )
  })

  it('should handle complex nested arrays and objects', () => {
    const params = {
      select: {
        id: true,
        name: true,
        details: {
          address: {
            street: 'Main St',
            city: 'Metropolis',
          },
          phoneNumbers: [
            {
              type: 'home',
              number: '123-456-7890',
            },
            {
              type: 'work',
              number: '098-765-4321',
            },
          ],
        },
      },
    }
    const result = encodeQueryParams(params)
    expect(result).toBe(
      'select%5Bid%5D=true&select%5Bname%5D=true&select%5Bdetails%5D%5Baddress%5D%5Bstreet%5D=Main%20St&select%5Bdetails%5D%5Baddress%5D%5Bcity%5D=Metropolis&select%5Bdetails%5D%5BphoneNumbers%5D%5B0%5D%5Btype%5D=home&select%5Bdetails%5D%5BphoneNumbers%5D%5B0%5D%5Bnumber%5D=123-456-7890&select%5Bdetails%5D%5BphoneNumbers%5D%5B1%5D%5Btype%5D=work&select%5Bdetails%5D%5BphoneNumbers%5D%5B1%5D%5Bnumber%5D=098-765-4321',
    )
  })

  it('should handle edge cases correctly', () => {
    const params = {
      select: {
        id: '',
        name: null,
        details: {
          address: {
            street: undefined,
            city: 'Metropolis',
          },
        },
      },
    }
    const result = encodeQueryParams(params)
    expect(result).toBe(
      'select%5Bid%5D=&select%5Bname%5D=null&select%5Bdetails%5D%5Baddress%5D%5Bcity%5D=Metropolis',
    )
  })

  it('should handle multiple nested levels correctly', () => {
    const params = {
      level1: {
        level2: {
          level3: {
            level4: {
              key: 'value',
            },
          },
        },
      },
    }
    const result = encodeQueryParams(params)
    expect(result).toBe(
      'level1%5Blevel2%5D%5Blevel3%5D%5Blevel4%5D%5Bkey%5D=value',
    )
  })

  it('should handle empty strings and null values correctly', () => {
    const params = {
      key1: '',
      key2: null,
      key3: 'value',
    }
    const result = encodeQueryParams(params)
    expect(result).toBe('key1=&key2=null&key3=value')
  })

  it('should encode special characters correctly', () => {
    const params = {
      name: "O'Reilly & Sons",
      description: '20% discount!',
    }
    const result = encodeQueryParams(params)
    expect(result).toBe(
      'name=O%27Reilly%20%26%20Sons&description=20%25%20discount%21',
    )
  })

  it('should handle empty arrays correctly', () => {
    const params = {
      filters: [],
    }
    const result = encodeQueryParams(params)
    expect(result).toBe('filters%5B%5D=')
  })

  it('should encode only special characters correctly', () => {
    const params = {
      special: '!@#$%^&*()_+{}|:"<>?[]\\;\',./`~',
    }
    const result = encodeQueryParams(params)
    expect(result).toBe(
      'special=%21%40%23%24%25%5E%26%2A%28%29_%2B%7B%7D%7C%3A%22%3C%3E%3F%5B%5D%5C%3B%27%2C.%2F%60%7E',
    )
  })

  it('should encode repeated special characters correctly', () => {
    const params = {
      special: '!!!@@@###$$$',
    }
    const result = encodeQueryParams(params)
    expect(result).toBe('special=%21%21%21%40%40%40%23%23%23%24%24%24')
  })

  it('should encode special characters in keys correctly', () => {
    const params = {
      'sp!ci@l': 'value',
      'key&with=special?chars': 'another value',
    }
    const result = encodeQueryParams(params)
    expect(result).toBe(
      'sp%21ci%40l=value&key%26with%3Dspecial%3Fchars=another%20value',
    )
  })

  it('should handle arrays with mixed types correctly', () => {
    const params = {
      mixedArray: [1, 'two', { three: 3 }],
    }
    const result = encodeQueryParams(params)
    expect(result).toBe(
      'mixedArray%5B0%5D=1&mixedArray%5B1%5D=two&mixedArray%5B2%5D%5Bthree%5D=3',
    )
  })

  it('should handle boolean and null values in nested objects correctly', () => {
    const params = {
      nested: {
        flag: true,
        notSet: null,
      },
    }
    const result = encodeQueryParams(params)
    expect(result).toBe('nested%5Bflag%5D=true&nested%5BnotSet%5D=null')
  })

  it('should handle empty strings in nested objects correctly', () => {
    const params = {
      nested: {
        emptyString: '',
        validString: 'value',
      },
    }
    const result = encodeQueryParams(params)
    expect(result).toBe(
      'nested%5BemptyString%5D=&nested%5BvalidString%5D=value',
    )
  })

  it('should handle deeply nested structures correctly', () => {
    const params = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: 'value',
            },
          },
        },
      },
    }
    const result = encodeQueryParams(params)
    expect(result).toBe(
      'level1%5Blevel2%5D%5Blevel3%5D%5Blevel4%5D%5Blevel5%5D=value',
    )
  })
})
