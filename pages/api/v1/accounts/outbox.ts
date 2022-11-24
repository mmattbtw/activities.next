import { sendNote } from '../../../../lib/activities'
import { ERROR_404 } from '../../../../lib/errors'
import { ApiGuard } from '../../../../lib/guard'
import { createStatus } from '../../../../lib/models/status'

const handler = ApiGuard(async (req, res, context) => {
  const { currentActor, storage } = context
  switch (req.method) {
    case 'POST': {
      const body = req.body
      const status = await createStatus({
        currentActor,
        text: body.message
      })
      await storage.createStatus({ status })
      const hosts = await storage.getFollowersHosts({
        targetActorId: currentActor.id
      })
      await Promise.all(
        hosts.map((host) => {
          const inbox = `https://${host}/inbox`
          return sendNote(currentActor, inbox, status)
        })
      )
      return res.status(200).json({ status })
    }
    default: {
      res.status(404).json(ERROR_404)
    }
  }
})

export default handler
