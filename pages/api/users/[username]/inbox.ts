import type { NextApiRequest, NextApiResponse } from 'next'

import { acceptFollowRequest } from '../../../../lib/actions/acceptFollowRequest'
import { createFollower } from '../../../../lib/actions/createFollower'
import { likeRequest } from '../../../../lib/actions/like'
import { rejectFollowRequest } from '../../../../lib/actions/rejectFollowRequest'
import { FollowRequest } from '../../../../lib/activities/actions/follow'
import { UndoFollow } from '../../../../lib/activities/actions/undoFollow'
import { UndoLike } from '../../../../lib/activities/actions/undoLike'
import { activitiesGuard } from '../../../../lib/guard'
import { FollowStatus } from '../../../../lib/models/follow'
import { DEFAULT_202, ERROR_400, ERROR_404 } from '../../../../lib/responses'
import { getStorage } from '../../../../lib/storage'

export default activitiesGuard(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
      const activity =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const storage = await getStorage()
      if (!storage) {
        return res.status(400).json(ERROR_400)
      }

      switch (activity.type) {
        case 'Accept': {
          const follow = await acceptFollowRequest({ activity, storage })
          if (!follow) {
            return res.status(404).json(ERROR_404)
          }
          return res.status(202).send('')
        }
        case 'Reject': {
          const follow = await rejectFollowRequest({ activity, storage })
          if (!follow) {
            return res.status(404).json(ERROR_404)
          }
          return res.status(202).send('')
        }
        case 'Follow': {
          const follow = await createFollower({
            followRequest: activity as FollowRequest,
            storage
          })
          if (!follow) {
            return res.status(404).json(ERROR_404)
          }
          return res.status(202).send({ target: follow.object })
        }
        case 'Like': {
          await likeRequest({ activity, storage })
          return res.status(202).send(DEFAULT_202)
        }
        case 'Undo': {
          const undoRequest = activity as UndoFollow | UndoLike
          switch (undoRequest.object.type) {
            case 'Follow': {
              const follow = await storage.getAcceptedOrRequestedFollow({
                actorId: undoRequest.object.actor,
                targetActorId: undoRequest.object.object
              })
              if (!follow) {
                console.error('Fail to find follow', undoRequest)
                return res.status(404).json(ERROR_404)
              }
              await storage.updateFollowStatus({
                followId: follow.id,
                status: FollowStatus.Undo
              })
              return res.status(202).send({ target: undoRequest.object.object })
            }
            case 'Like': {
              await storage.deleteLike({
                actorId: undoRequest.object.actor,
                statusId:
                  typeof undoRequest.object.object === 'string'
                    ? undoRequest.object.object
                    : undoRequest.object.object.id
              })
              return res.status(202).send(DEFAULT_202)
            }
            default: {
              return res.status(202).send(DEFAULT_202)
            }
          }
        }
        default:
          return res.status(202).send(DEFAULT_202)
      }
    }

    return res.status(404).json(ERROR_404)
  },
  ['POST']
)
