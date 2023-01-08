import { AnnounceStatus } from '../activities/actions/announceStatus'
import { Note } from '../activities/entities/note'
import { compact } from '../jsonld'
import { Actor } from '../models/actor'
import { Storage } from '../storage/types'

interface AnnounceParams {
  status: AnnounceStatus
  storage: Storage
}
export const announce = async ({ status, storage }: AnnounceParams) => {
  const compactedStatus = (await compact(status)) as AnnounceStatus
  const { object } = compactedStatus

  const existingStatus = await storage.getStatus({
    statusId: object
  })
  if (!existingStatus) {
    const response = await fetch(object)
    if (response.status !== 200) return

    const boostedStatus = await response.json()
    const compactedBoostedStatus = (await compact(boostedStatus)) as Note
    await storage.createNote({
      id: compactedBoostedStatus.id,
      url: compactedBoostedStatus.url || compactedBoostedStatus.id,

      actorId: compactedBoostedStatus.attributedTo,

      text: compactedBoostedStatus.content,
      summary: compactedBoostedStatus.summary || '',

      to: Array.isArray(boostedStatus.to)
        ? boostedStatus.to
        : [boostedStatus.to].filter((item) => item),
      cc: Array.isArray(boostedStatus.cc)
        ? boostedStatus.cc
        : [boostedStatus.cc].filter((item) => item),

      reply: compactedBoostedStatus.inReplyTo || '',
      createdAt: new Date(compactedBoostedStatus.published).getTime()
    })
  }

  await storage.createAnnounce({
    id: compactedStatus.id,
    actorId: compactedStatus.actor,
    to: Array.isArray(status.to)
      ? status.to
      : [status.to].filter((item) => item),
    cc: Array.isArray(status.cc)
      ? status.cc
      : [status.cc].filter((item) => item),
    originalStatusId: object
  })
}

interface UserAnnounceParams {
  currentActor: Actor
  statusId: string
  storage: Storage
}
export const userAnnounce = async ({ statusId }: UserAnnounceParams) => {
  console.log(statusId)
}
