import fetchMock, { enableFetchMocks } from 'jest-fetch-mock'

import { getWebfingerSelf, sendNote } from '.'
import { createStatus } from '../models/status'
import { MockActor } from '../stub/actor'
import { MockWebfinger } from '../stub/webfinger'
import { CreateStatus } from './actions/createStatus'

jest.mock('../config', () => {
  const originalModule = jest.requireActual('../config')
  const { MOCK_SECRET_PHASES } = jest.requireActual('../stub/actor')
  return {
    __esModule: true,
    ...originalModule,
    getConfig: jest.fn().mockReturnValue({
      host: 'llun.test',
      database: {},
      allowEmails: [],
      secretPhase: MOCK_SECRET_PHASES,
      auth: {}
    })
  }
})

enableFetchMocks()

describe('#getWebfingerSelf', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  it('returns self href from the webfinger', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify(MockWebfinger({ account: 'null@llun.dev' }))
    )

    const selfUrl = await getWebfingerSelf('null@llun.dev')
    expect(selfUrl).toEqual('https://llun.dev/users/null')
  })

  it('returns null for invalid account', async () => {
    const selfUrl = await getWebfingerSelf('null')
    expect(selfUrl).toBeNull()
  })

  it('returns null for not found account', async () => {
    fetchMock.mockResponseOnce('Not Found', {
      status: 404
    })

    const selfUrl = await getWebfingerSelf('null@llun.dev')
    expect(selfUrl).toBeNull()
  })
})

describe('#sendNote', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  it('fetch to shared inbox', async () => {
    fetchMock.mockResponseOnce('', {
      status: 200
    })
    const actor = MockActor({})
    const { status, mentions } = await createStatus({
      currentActor: actor,
      text: 'Hello'
    })

    await sendNote({
      currentActor: actor,
      sharedInbox: 'https://llun.dev/inbox',
      status,
      mentions
    })
    const [, options] = fetchMock.mock.lastCall as any
    const { body } = options
    const data = JSON.parse(body) as CreateStatus
    const object = data.object
    expect(object.content).toEqual('<p>Hello</p>')
    expect(object.to).toContain('https://www.w3.org/ns/activitystreams#Public')
    expect(object.cc).toContain('https://chat.llun.dev/users/me/followers')
  })
})