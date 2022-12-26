import { Note } from '../activities/entities/note'
import { compact } from '../jsonld'
import { Sqlite3Storage } from '../storage/sqlite3'
import { MockMastodonNote } from '../stub/note'
import { seedActor1 } from '../stub/seed/actor1'
import { seedActor2 } from '../stub/seed/actor2'
import { seedStorage } from '../stub/storage'
import { getISOTimeUTC } from '../time'
import { Actor } from './actor'
import { Status } from './status'

// describe('#createStatus', () => {
//   const mockActor = MockActor({})
//   const mockStatus = MockStatus({ text: 'This is sample reply message' })

//   it('returns plain text status from content', async () => {
//     const { status } = await createStatus({
//       currentActor: mockActor,
//       text: 'This is a first post',
//       storage: mockStorage
//     })

//     expect(status.actorId).toEqual(mockActor.id)
//     expect(status.type).toEqual('Note')
//     expect(status.to).toContain('https://www.w3.org/ns/activitystreams#Public')
//     expect(status.cc).toContain(`${mockActor.id}/followers`)
//     expect(status.text).toEqual('<p>This is a first post</p>')
//   })

//   it('returns status with conversation and mentions from reply', async () => {
//     const { status, mentions } = await createStatus({
//       currentActor: mockActor,
//       text: '@thai@earth.social Hey! how are you?',
//       replyStatus: mockStatus,
//       storage: mockStorage
//     })
//     expect(status.text).toEqual(
//       '<p><span class="h-card"><a href="https://earth.social/@thai" class="u-url mention">@<span>thai</span></a></span> Hey! how are you?</p>'
//     )
//     expect(status.cc).toContain(`https://earth.social/users/thai`)
//     expect(mentions).toHaveLength(1)
//     expect(mentions).toContainEqual({
//       type: 'Mention',
//       href: 'https://earth.social/users/thai',
//       name: '@thai@earth.social'
//     })
//   })

//   it('adds localRecipients in status', async () => {
//     const mockActorWithLocaleFollowers = MockActor({
//       id: 'https://chat.llun.dev/users/user3'
//     })
//     const { status } = await createStatus({
//       currentActor: mockActorWithLocaleFollowers,
//       text: '@thai@earth.social Hey! how are you?',
//       replyStatus: mockStatus,
//       storage: mockStorage
//     })
//     expect(status.localRecipients).toContain(
//       'https://chat.llun.dev/users/user3'
//     )
//     expect(status.localRecipients).toContain(
//       'https://chat.llun.dev/users/user4'
//     )
//   })
// })

describe('Status', () => {
  const storage = new Sqlite3Storage({
    client: 'sqlite3',
    useNullAsDefault: true,
    connection: {
      filename: ':memory:'
    }
  })

  beforeAll(async () => {
    await storage.migrate()
    await seedStorage(storage)
  })

  afterAll(async () => {
    if (!storage) return
    await storage.destroy()
  })

  describe('#fromNote', () => {
    it('returns status from json', async () => {
      const note = MockMastodonNote({
        content: 'Hello',
        inReplyTo: 'https://other.network/users/test/status/1',
        withContext: true
      })
      const compactedNote = (await compact(note)) as Note
      const status = Status.fromNote(compactedNote)
      expect(status).toEqual({
        id: 'https://llun.test/users/llun/statuses/109417500731428509',
        url: 'https://llun.test/@llun/109417500731428509',
        actorId: 'https://llun.test/users/llun',
        type: 'Note',
        text: 'Hello',
        summary: '',
        to: ['as:Public'],
        cc: [],
        localRecipients: [],
        attachments: [],
        reply: 'https://other.network/users/test/status/1',
        createdAt: expect.toBeNumber(),
        updatedAt: expect.toBeNumber()
      })
    })

    it('returns null for undefined reply', async () => {
      const note = MockMastodonNote({
        content: 'Hello',
        withContext: true
      })
      const compactedNote = (await compact(note)) as Note
      const json = Status.fromNote(compactedNote)
      expect(json).toEqual({
        id: 'https://llun.test/users/llun/statuses/109417500731428509',
        url: 'https://llun.test/@llun/109417500731428509',
        actorId: 'https://llun.test/users/llun',
        type: 'Note',
        text: 'Hello',
        summary: '',
        to: ['as:Public'],
        cc: [],
        localRecipients: [],
        attachments: [],
        reply: '',
        createdAt: expect.toBeNumber(),
        updatedAt: expect.toBeNumber()
      })
    })
  })

  describe('#toObject', () => {
    let actor1: Actor | undefined
    let actor2: Actor | undefined

    beforeAll(async () => {
      actor1 = await storage.getActorFromUsername({
        username: seedActor1.username
      })
      actor2 = await storage.getActorFromUsername({
        username: seedActor2.username
      })
    })

    it('converts status to Note object', async () => {
      const status = await storage.getStatus({
        statusId: `${actor1?.id}/statuses/post-1`
      })
      const note = status?.toObject()
      expect(note).toEqual({
        id: status?.id,
        type: 'Note',
        summary: null,
        inReplyTo: null,
        published: getISOTimeUTC(status?.createdAt ?? 0),
        url: status?.url,
        attributedTo: status?.actorId,
        to: status?.to,
        cc: status?.cc,
        content: status?.text,
        attachment: [],
        tag: [],
        replies: {
          id: `${status?.id}/replies`,
          type: 'Collection',
          first: {
            type: 'CollectionPage',
            next: `${status?.id}/replies?only_other_accounts=true&page=true`,
            partOf: `${status?.id}/replies`,
            items: []
          }
        }
      })
    })

    it('add mentions into Note object', async () => {
      const status = await storage.getStatus({
        statusId: `${actor2?.id}/statuses/post-2`
      })
      const note = status?.toObject()
      expect(note).toMatchObject({
        id: status?.id,
        type: 'Note',
        summary: null,
        inReplyTo: `${actor1?.id}/statuses/post-1`,
        published: getISOTimeUTC(status?.createdAt ?? 0),
        url: status?.url,
        attributedTo: status?.actorId,
        to: status?.to,
        cc: status?.cc,
        content: status?.text,
        attachment: [],
        tag: status?.getMentions(),
        replies: {
          id: `${status?.id}/replies`,
          type: 'Collection',
          first: {
            type: 'CollectionPage',
            next: `${status?.id}/replies?only_other_accounts=true&page=true`,
            partOf: `${status?.id}/replies`,
            items: []
          }
        }
      })
    })
  })
})
