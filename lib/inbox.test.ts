import { Note } from './activities/entities/note'
import { deliverTo, isFollowerId, isLocalFollowerId } from './inbox'
import { compact } from './jsonld'
import {
  GetActorFromIdParams,
  GetLocalFollowersForActorIdParams
} from './storage/types'
import { MockActor } from './stub/actor'
import { MockMastodonNote } from './stub/note'

jest.mock('./config', () => ({
  __esModule: true,
  getConfig: jest.fn().mockReturnValue({
    host: 'llun.test'
  })
}))

const mockStorage = {
  getActorFromId: jest.fn(async ({ id }: GetActorFromIdParams) => {
    if (['https://llun.test/users/null'].includes(id)) return MockActor({ id })
  }),
  getLocalFollowersForActorId: jest.fn(
    async ({ targetActorId }: GetLocalFollowersForActorIdParams) => {
      if (targetActorId === 'https://mastodon.in.th/users/friend') {
        return ['https://llun.test/users/null']
      }
      return []
    }
  )
} as any

describe('#isFollowerId', () => {
  it('returns true when id ends with followers', () => {
    expect(isFollowerId('https://llun.test/users/null/followers')).toBeTruthy()
  })

  it('returns false when id is not followers', () => {
    expect(isFollowerId('https://llun.test/users/null')).toBeFalsy()
  })
})

describe('#deliverTo', () => {
  it('concats to and cc to single list', async () => {
    const note = MockMastodonNote({
      content: 'Hello',
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: ['https://llun.test/users/null'],
      withContext: true
    })
    const compactedNote = (await compact(note)) as Note
    expect(
      await deliverTo({ note: compactedNote, storage: mockStorage })
    ).toEqual(['as:Public', 'https://llun.test/users/null'])
  })

  it('remove non-existing users from the list except public', async () => {
    const note = MockMastodonNote({
      content: 'Hello',
      to: [
        'https://www.w3.org/ns/activitystreams#Public',
        'https://llun.test/users/null'
      ],
      cc: [
        'https://llun.test/users/non-existing',
        'https://other.federate/users/someone'
      ],
      withContext: true
    })
    const compactedNote = (await compact(note)) as Note
    expect(
      await deliverTo({ note: compactedNote, storage: mockStorage })
    ).toEqual(['as:Public', 'https://llun.test/users/null'])
  })
  it('spread the followers and returns only users that exists in the system', async () => {
    const note = MockMastodonNote({
      content: 'Hello',
      to: [
        'https://www.w3.org/ns/activitystreams#Public',
        'https://mastodon.in.th/users/friend'
      ],
      cc: ['https://mastodon.in.th/users/friend/followers'],
      withContext: true
    })
    const compactedNote = (await compact(note)) as Note
    expect(
      await deliverTo({ note: compactedNote, storage: mockStorage })
    ).toEqual(['as:Public', 'https://llun.test/users/null'])
  })
})
