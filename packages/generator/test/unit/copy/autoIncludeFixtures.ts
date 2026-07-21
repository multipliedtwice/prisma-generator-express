import type { ModelRelationMap } from '../../../src/copy/autoIncludePlanner'

export const models: Record<string, ModelRelationMap> = {
  User: {
    name: 'User',
    delegateKey: 'user',
    scalarFields: ['id', 'name', 'profileId'],
    relations: {
      posts: {
        name: 'posts',
        type: 'Post',
        isList: true,
        isRequired: false,
        direction: 'childOwnsFk',
        parentLinkFields: ['id'],
        childLinkFields: ['userId'],
      },
      profile: {
        name: 'profile',
        type: 'Profile',
        isList: false,
        isRequired: false,
        direction: 'parentOwnsFk',
        parentLinkFields: ['profileId'],
        childLinkFields: ['id'],
      },
      groups: {
        name: 'groups',
        type: 'Group',
        isList: true,
        isRequired: false,
        direction: 'implicitM2M',
        parentLinkFields: [],
        childLinkFields: [],
      },
    },
  },
  Post: {
    name: 'Post',
    delegateKey: 'post',
    scalarFields: ['id', 'title', 'userId'],
    relations: {
      author: {
        name: 'author',
        type: 'User',
        isList: false,
        isRequired: true,
        direction: 'parentOwnsFk',
        parentLinkFields: ['userId'],
        childLinkFields: ['id'],
      },
      comments: {
        name: 'comments',
        type: 'Comment',
        isList: true,
        isRequired: false,
        direction: 'childOwnsFk',
        parentLinkFields: ['id'],
        childLinkFields: ['postId'],
      },
    },
  },
  Profile: {
    name: 'Profile',
    delegateKey: 'profile',
    scalarFields: ['id', 'bio'],
    relations: {},
  },
  Comment: {
    name: 'Comment',
    delegateKey: 'comment',
    scalarFields: ['id', 'postId', 'body'],
    relations: {},
  },
  Group: {
    name: 'Group',
    delegateKey: 'group',
    scalarFields: ['id', 'name'],
    relations: {},
  },
}
