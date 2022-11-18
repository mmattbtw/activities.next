import type { NextApiRequest, NextApiResponse } from 'next'
import { unstable_getServerSession } from 'next-auth'
import { follow, unfollow } from '../../../../lib/activities'
import { ERROR_404 } from '../../../../lib/errors'
import { getStorage } from '../../../../lib/storage'
import { authOptions } from '../../auth/[...nextauth]'

type Data =
  | {
      error?: string
    }
  | {
      done: boolean
    }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  switch (req.method) {
    case 'POST': {
      const [storage, session] = await Promise.all([
        getStorage(),
        unstable_getServerSession(req, res, authOptions)
      ])
      if (!storage || !session?.user?.email) {
        return res.status(302).redirect('/singin')
      }

      const { target } = req.body
      const currentActor = await storage.getActorFromEmail(session.user.email)
      if (!currentActor) {
        return res.status(302).redirect('/singin')
      }

      const follow = await storage.getAcceptedOrRequestedFollow(
        currentActor.id,
        target
      )
      if (!follow) {
        return res.status(404).json(ERROR_404)
      }

      await Promise.all([
        unfollow(currentActor, follow),
        storage.updateFollowStatus(follow.id, 'Undo')
      ])
      return res.status(200).json({ done: true })
    }
    default:
      res.status(404).json(ERROR_404)
  }
}