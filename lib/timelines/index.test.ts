import { randomBytes } from 'crypto'

import { addStatusToTimelines } from '.'
import { ACTIVITY_STREAM_PUBLIC } from '../jsonld/activitystream'
import { Sqlite3Storage } from '../storage/sqlite3'
import { mockRequests } from '../stub/activities'
import { ACTOR1_ID } from '../stub/seed/actor1'
import {
  EXTERNAL_ACTOR1,
  EXTERNAL_ACTOR1_FOLLOWERS
} from '../stub/seed/external1'
import { seedStorage } from '../stub/storage'
import { Timeline } from './types'

describe('#addStatusToTimeline', () => {
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

  beforeEach(() => {
    fetchMock.resetMocks()
    mockRequests(fetchMock)
  })

  test('it adds status to local users main timeline', async () => {
    const id = randomBytes(16).toString('hex')
    const status = await storage.createNote({
      id: `${EXTERNAL_ACTOR1}/statuses/${id}`,
      url: `${EXTERNAL_ACTOR1}/statuses/${id}`,
      actorId: EXTERNAL_ACTOR1,
      to: [ACTIVITY_STREAM_PUBLIC],
      cc: [EXTERNAL_ACTOR1_FOLLOWERS],
      text: 'message to followers'
    })
    await addStatusToTimelines(storage, status)
    const mainTimeline = await storage.getTimeline({
      timeline: Timeline.MAIN,
      actorId: ACTOR1_ID
    })
    expect(mainTimeline).toHaveLength(1)

    const noannounceTimeline = await storage.getTimeline({
      timeline: Timeline.NOANNOUNCE,
      actorId: ACTOR1_ID
    })
    expect(noannounceTimeline).toHaveLength(1)
  })
})
