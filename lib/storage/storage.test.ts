import { FollowStatus } from '../models/follow'
import { FirebaseStorage } from './firebase'
import { Sqlite3Storage } from './sqlite3'
import { Storage } from './types'

jest.mock('../config', () => ({
  getConfig: () => ({ host: 'llun.test', secretPhase: 'secret' })
}))

// For testing existing user
const TEST_EMAIL = 'user@llun.dev'
const TEST_USERNAME = 'user'
const TEST_ID = 'https://llun.test/users/user'

// For testing create new account
const TEST_EMAIL2 = 'user2@llun.dev'
const TEST_USERNAME2 = 'user2'

// User that follow other without any followers
const TEST_EMAIL3 = 'user3@llun.dev'
const TEST_USERNAME3 = 'user3'
const TEST_ID3 = 'https://llun.test/users/user3'

// User that get someone follow them
const TEST_EMAIL4 = 'user4@llun.dev'
const TEST_USERNAME4 = 'user4'
const TEST_ID4 = 'https://llun.test/users/user4'

// Get statuses test user
const TEST_EMAIL5 = 'user5@llun.dev'
const TEST_USERNAME5 = 'user5'
const TEST_ID5 = 'https://llun.test/users/user5'

// Get Actor statuses test user
const TEST_EMAIL6 = 'user6@llun.dev'
const TEST_USERNAME6 = 'user6'
const TEST_ID6 = 'https://llun.test/users/user6'

type TestStorage = [string, Storage]

describe('Storage', () => {
  const testTable: TestStorage[] = [
    [
      'sqlite',
      new Sqlite3Storage({
        client: 'sqlite3',
        useNullAsDefault: true,
        connection: {
          filename: ':memory:'
        }
      })
    ],
    // Enable this when run start:firestore emulator and clear the database manually
    [
      'firestore',
      new FirebaseStorage({
        type: 'firebase',
        projectId: 'test'
      })
    ]
  ]

  beforeAll(async () => {
    const sqlItem = testTable.find((value) => value[0] === 'sqlite')
    if (sqlItem) await (sqlItem[1] as Sqlite3Storage).migrate()

    const firestoreItem = testTable.find((value) => value[0] === 'firestore')
    if (firestoreItem)
      await (firestoreItem[1] as FirebaseStorage).connectEmulator()
  })

  afterAll(async () => {
    for (const item of testTable) {
      const storage = item[1]
      await storage.destroy()
    }
  })

  describe.each(testTable)(`%s`, (name, storage) => {
    beforeAll(async () => {
      await storage.createAccount({
        email: TEST_EMAIL,
        username: TEST_USERNAME,
        privateKey: 'privateKey1',
        publicKey: 'publicKey1'
      })
      await storage.createAccount({
        email: TEST_EMAIL3,
        username: TEST_USERNAME3,
        privateKey: 'privateKey3',
        publicKey: 'publicKey3'
      })
      await storage.createAccount({
        email: TEST_EMAIL4,
        username: TEST_USERNAME4,
        privateKey: 'privateKey4',
        publicKey: 'publicKey4'
      })
      await storage.createAccount({
        email: TEST_EMAIL5,
        username: TEST_USERNAME5,
        privateKey: 'privateKey5',
        publicKey: 'publicKey5'
      })
      await storage.createAccount({
        email: TEST_EMAIL6,
        username: TEST_USERNAME6,
        privateKey: 'privateKey6',
        publicKey: 'publicKey6'
      })
    })

    describe('accounts', () => {
      it('returns false when account is not created yet', async () => {
        expect(
          await storage.isAccountExists({ email: TEST_EMAIL2 })
        ).toBeFalse()
        expect(
          await storage.isUsernameExists({ username: TEST_USERNAME2 })
        ).toBeFalse()
      })

      it('creates account and actor', async () => {
        await storage.createAccount({
          email: TEST_EMAIL2,
          username: TEST_USERNAME2,
          privateKey: 'privateKey2',
          publicKey: 'publicKey2'
        })
        expect(await storage.isAccountExists({ email: TEST_EMAIL2 })).toBeTrue()
        expect(
          await storage.isUsernameExists({ username: TEST_USERNAME2 })
        ).toBeTrue()
      })

      it('returns actor from getActor methods', async () => {
        const expectedActorAfterCreated = {
          id: TEST_ID,
          preferredUsername: TEST_USERNAME,
          account: {
            id: expect.toBeString(),
            email: TEST_EMAIL
          },
          publicKey: expect.toBeString(),
          privateKey: expect.toBeString()
        }
        expect(
          await storage.getActorFromEmail({ email: TEST_EMAIL })
        ).toMatchObject(expectedActorAfterCreated)
        expect(
          await storage.getActorFromUsername({ username: TEST_USERNAME })
        ).toMatchObject(expectedActorAfterCreated)
        expect(await storage.getActorFromId({ id: TEST_ID })).toMatchObject(
          expectedActorAfterCreated
        )
      })

      it('updates actor information', async () => {
        const currentActor = await storage.getActorFromUsername({
          username: TEST_USERNAME
        })
        if (!currentActor) fail('Current actor must not be null')

        await storage.updateActor({
          actor: {
            ...currentActor,
            name: 'llun',
            summary: 'This is test actor'
          }
        })

        expect(
          await storage.getActorFromUsername({ username: TEST_USERNAME })
        ).toMatchObject({
          name: 'llun',
          summary: 'This is test actor'
        })
      })
    })

    describe('follows', () => {
      it('returns empty followers and following', async () => {
        expect(
          await storage.getActorFollowersCount({ actorId: TEST_ID })
        ).toEqual(0)
        expect(
          await storage.getActorFollowingCount({ actorId: TEST_ID })
        ).toEqual(0)
        expect(
          await storage.getFollowersHosts({ targetActorId: TEST_ID })
        ).toEqual([])
        expect(
          await storage.getFollowersInbox({ targetActorId: TEST_ID })
        ).toEqual([])
      })

      it('following other actor', async () => {
        const targetActorHost = 'llun.dev'
        const targetActorId = 'https://llun.dev/users/null'
        const inbox = `${TEST_ID3}/inbox`
        const sharedInbox = 'https://llun.test/inbox'

        const follow = await storage.createFollow({
          actorId: TEST_ID3,
          targetActorId,
          status: FollowStatus.Requested,
          // Inbox is always for actor, not targetActor
          inbox,
          sharedInbox
        })
        expect(follow).toEqual({
          actorHost: 'llun.test',
          actorId: TEST_ID3,
          createdAt: expect.toBeNumber(),
          id: expect.toBeString(),
          inbox,
          sharedInbox,
          status: FollowStatus.Requested,
          targetActorHost,
          targetActorId,
          updatedAt: expect.toBeNumber()
        })
        expect(
          await storage.isCurrentActorFollowing({
            currentActorId: TEST_ID3,
            followingActorId: targetActorId
          })
        ).toBeFalse()

        expect(
          await storage.getAcceptedOrRequestedFollow({
            actorId: TEST_ID3,
            targetActorId: 'https://llun.dev/users/null'
          })
        ).toEqual({
          actorHost: 'llun.test',
          actorId: TEST_ID3,
          createdAt: expect.toBeNumber(),
          id: follow.id,
          inbox,
          sharedInbox,
          status: FollowStatus.Requested,
          targetActorHost,
          targetActorId,
          updatedAt: expect.toBeNumber()
        })

        expect(
          await storage.getActorFollowingCount({ actorId: TEST_ID3 })
        ).toEqual(0)

        await storage.updateFollowStatus({
          followId: follow.id,
          status: FollowStatus.Rejected
        })
        expect(
          await storage.isCurrentActorFollowing({
            currentActorId: TEST_ID3,
            followingActorId: targetActorId
          })
        ).toBeFalse()
        expect(
          await storage.getAcceptedOrRequestedFollow({
            actorId: TEST_ID3,
            targetActorId
          })
        ).toBeUndefined()

        // Make sure that second follow time is not the same as first follow
        await new Promise((resolve) => setTimeout(resolve, 10))

        const secondFollow = await storage.createFollow({
          actorId: TEST_ID3,
          targetActorId,
          status: FollowStatus.Requested,
          inbox,
          sharedInbox
        })
        expect(secondFollow.id).not.toEqual(follow.id)
        expect(
          await storage.getFollowFromId({ followId: secondFollow.id })
        ).toEqual(secondFollow)
        expect(
          await storage.getAcceptedOrRequestedFollow({
            actorId: TEST_ID3,
            targetActorId
          })
        ).toEqual({
          actorHost: 'llun.test',
          actorId: TEST_ID3,
          createdAt: expect.toBeNumber(),
          id: secondFollow.id,
          inbox,
          sharedInbox,
          status: FollowStatus.Requested,
          targetActorHost,
          targetActorId,
          updatedAt: expect.toBeNumber()
        })

        await storage.updateFollowStatus({
          followId: secondFollow.id,
          status: FollowStatus.Accepted
        })
        const secondFollowAfterUpdated =
          await storage.getAcceptedOrRequestedFollow({
            actorId: TEST_ID3,
            targetActorId
          })
        expect(secondFollowAfterUpdated).toEqual({
          actorHost: 'llun.test',
          actorId: TEST_ID3,
          createdAt: expect.toBeNumber(),
          id: secondFollow.id,
          inbox,
          sharedInbox,
          status: FollowStatus.Accepted,
          targetActorHost,
          targetActorId,
          updatedAt: expect.toBeNumber()
        })
        expect(secondFollowAfterUpdated?.updatedAt).not.toEqual(
          secondFollow.updatedAt
        )
        expect(
          await storage.isCurrentActorFollowing({
            currentActorId: TEST_ID3,
            followingActorId: targetActorId
          })
        ).toBeTrue()

        expect(
          await storage.getActorFollowingCount({ actorId: TEST_ID3 })
        ).toEqual(1)

        expect(await storage.getFollowersHosts({ targetActorId })).toEqual([
          'llun.test'
        ])
        expect(await storage.getFollowersInbox({ targetActorId })).toEqual([
          sharedInbox
        ])
      })

      it('gets other actor follow (follower)', async () => {
        const actorId = 'https://llun.dev/users/test2'
        const inbox = `${actorId}/inbox`
        const sharedInbox = 'https://llun.dev/inbox'

        await storage.createFollow({
          actorId,
          targetActorId: TEST_ID4,
          status: FollowStatus.Accepted,
          inbox,
          sharedInbox
        })
        expect(
          await storage.getActorFollowersCount({ actorId: TEST_ID4 })
        ).toEqual(1)

        expect(
          await storage.getFollowersHosts({ targetActorId: TEST_ID4 })
        ).toEqual(['llun.dev'])
        expect(
          await storage.getFollowersInbox({ targetActorId: TEST_ID4 })
        ).toEqual([sharedInbox])

        const follows = await storage.getLocalFollowersForActorId({
          targetActorId: TEST_ID4
        })
        expect(follows.length).toEqual(0)

        await storage.createFollow({
          actorId: TEST_ID3,
          targetActorId: TEST_ID4,
          status: FollowStatus.Accepted,
          inbox: `${TEST_ID3}/inbox`,
          sharedInbox: 'https://llun.test/inbox'
        })
        const followsAfterLocalFollow =
          await storage.getLocalFollowersForActorId({
            targetActorId: TEST_ID4
          })
        expect(followsAfterLocalFollow.length).toEqual(1)
      })
    })

    describe('statuses', () => {
      it('creates a new status', async () => {
        const postId = 'post-1'
        const id = `${TEST_ID}/statuses/${postId}`

        const status = await storage.createStatus({
          id,
          url: id,
          actorId: TEST_ID,
          type: 'Note',

          text: 'Test Status',
          to: ['https://www.w3.org/ns/activitystreams#Public'],
          cc: []
        })
        expect(status.data).toEqual({
          id,
          url: id,
          actorId: TEST_ID,
          type: 'Note',

          text: 'Test Status',
          summary: '',
          to: ['https://www.w3.org/ns/activitystreams#Public'],
          cc: [],
          attachments: [],
          tags: [],
          reply: '',
          createdAt: expect.toBeNumber(),
          updatedAt: expect.toBeNumber()
        })
        expect(
          await storage.getActorStatusesCount({ actorId: TEST_ID })
        ).toEqual(1)
      })

      it('returns attachments with status', async () => {
        const postId = 'post-2'
        const id = `${TEST_ID}/statuses/${postId}`

        await storage.createStatus({
          id,
          url: id,
          actorId: TEST_ID,
          type: 'Note',

          text: 'Test Status',
          to: ['https://www.w3.org/ns/activitystreams#Public'],
          cc: []
        })
        const attachment = await storage.createAttachment({
          statusId: id,
          mediaType: 'image/png',
          url: 'https://via.placeholder.com/150',
          width: 150,
          height: 150
        })

        const persistedStatus = await storage.getStatus({ statusId: id })
        expect(persistedStatus?.data.attachments).toHaveLength(1)
        expect(persistedStatus?.data.attachments[0]).toMatchObject(attachment)
      })

      it('returns tags with status', async () => {
        const postId = 'post-3'
        const id = `${TEST_ID}/statuses/${postId}`
        await storage.createStatus({
          id,
          url: id,
          actorId: TEST_ID,
          type: 'Note',

          text: '@<a href="https://llun.test/@test2">test2</a> Test mentions',
          to: ['https://www.w3.org/ns/activitystreams#Public'],
          cc: []
        })
        const tag = await storage.createTag({
          statusId: id,
          name: '@test2@llun.test',
          value: 'https://llun.test/@test2'
        })
        const persistedStatus = await storage.getStatus({ statusId: id })
        expect(persistedStatus?.data.tags).toHaveLength(1)
        expect(persistedStatus?.data.tags[0]).toMatchObject(tag)
      })

      it('returns all statuses', async () => {
        const sender = 'https://llun.dev/users/null'
        for (let i = 0; i < 50; i++) {
          const statusId = `https://llun.dev/users/null/statuses/post-${i + 1}`
          await storage.createStatus({
            id: statusId,
            url: statusId,
            actorId: sender,
            type: 'Note',

            text: `Status ${i + 1}`,
            to: ['https://www.w3.org/ns/activitystreams#Public', TEST_ID5],
            cc: []
          })
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        const statuses = await storage.getStatuses({ actorId: TEST_ID5 })
        expect(statuses.length).toEqual(30)
        for (const index in statuses) {
          const statusId = `https://llun.dev/users/null/statuses/post-${
            50 - parseInt(index, 10)
          }`
          const expectedStatus = await storage.getStatus({ statusId })
          expect(statuses[index].toJson()).toEqual(expectedStatus?.toJson())
        }
      })

      it('returns actor statuses', async () => {
        for (let i = 1; i <= 3; i++) {
          const statusId = `${TEST_ID6}/statuses/post-${i}`
          await storage.createStatus({
            id: statusId,
            url: statusId,
            actorId: TEST_ID6,
            type: 'Note',

            text: `Status ${i + 1}`,
            to: ['https://www.w3.org/ns/activitystreams#Public', TEST_ID6],
            cc: []
          })
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        expect(
          await storage.getActorStatusesCount({ actorId: TEST_ID6 })
        ).toEqual(3)

        const statuses = await storage.getActorStatuses({ actorId: TEST_ID6 })
        for (let i = 0; i < statuses.length; i++) {
          const status = await storage.getStatus({
            statusId: `${TEST_ID6}/statuses/post-${3 - i}`
          })
          expect(statuses[i]).toEqual(status)
        }

        await storage.deleteStatus({ statusId: `${TEST_ID6}/statuses/post-2` })
        expect(
          await storage.getActorStatusesCount({ actorId: TEST_ID6 })
        ).toEqual(2)

        const statusesAfterDelete = await storage.getActorStatuses({
          actorId: TEST_ID6
        })
        expect(statusesAfterDelete.length).toEqual(2)
        expect(statusesAfterDelete[0]).toEqual(
          await storage.getStatus({ statusId: `${TEST_ID6}/statuses/post-3` })
        )
        expect(statusesAfterDelete[1]).toEqual(
          await storage.getStatus({ statusId: `${TEST_ID6}/statuses/post-1` })
        )
      })
    })
  })
})
