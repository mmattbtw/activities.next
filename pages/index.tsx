/* eslint-disable camelcase */
import cn from 'classnames'
import { GetServerSideProps, NextPage } from 'next'
import { unstable_getServerSession } from 'next-auth/next'
import { useSession } from 'next-auth/react'
import Head from 'next/head'
import Image from 'next/image'
import { useRef, useState } from 'react'

import { Header } from '../lib/components/Header'
import { PostBox } from '../lib/components/PostBox/PostBox'
import { Posts } from '../lib/components/Posts/Posts'
import { Profile as ProfileComponent } from '../lib/components/Profile'
import { getConfig } from '../lib/config'
import {
  Profile,
  getAtUsernameFromId,
  getAtWithHostFromId,
  getProfileFromActor
} from '../lib/models/actor'
import { StatusData } from '../lib/models/status'
import { getStorage } from '../lib/storage'
import { authOptions } from './api/auth/[...nextauth]'
import styles from './index.module.scss'

interface Props {
  host: string
  currentServerTime: number
  statuses: StatusData[]
  profile: Profile
  totalPosts: number
  followersCount: number
  followingCount: number
}

const Page: NextPage<Props> = ({
  host,
  profile,
  statuses,
  currentServerTime,
  totalPosts,
  followersCount,
  followingCount
}) => {
  const { data: session } = useSession()
  const [replyStatus, setReplyStatus] = useState<StatusData>()
  const [currentStatuses, setCurrentStatuses] = useState<StatusData[]>(statuses)
  const postBoxRef = useRef<HTMLTextAreaElement>(null)

  const onReply = (status: StatusData) => {
    setReplyStatus(status)
    window.scrollTo({ top: 0 })

    if (!postBoxRef.current) return
    const postBox = postBoxRef.current

    const replyText = `${getAtWithHostFromId(status.actorId)} `
    postBox.value = replyText
    postBox.selectionStart = replyText.length
    postBox.selectionEnd = replyText.length
    postBox.focus()
  }

  const onPostDeleted = (status: StatusData) => {
    const statusIndex = currentStatuses.indexOf(status)
    setCurrentStatuses([
      ...currentStatuses.slice(0, statusIndex),
      ...currentStatuses.slice(statusIndex + 1)
    ])
  }

  return (
    <main>
      <Head>
        <title>Activities: timeline</title>
      </Head>
      <Header session={session} />
      <section className="container pt-4">
        <div className="row">
          <div className="col-12 col-md-3">
            {profile.iconUrl && (
              <Image
                width={100}
                height={100}
                alt="Actor icon"
                className={cn(styles.icon, 'me-4', 'mb-2', 'flex-shrink-0')}
                src={profile.iconUrl}
              />
            )}
            <ProfileComponent
              name={profile.name || ''}
              url={`https://${host}/${getAtUsernameFromId(profile.id)}`}
              id={profile.id}
              totalPosts={totalPosts}
              followersCount={followersCount}
              followingCount={followingCount}
              createdAt={profile.createdAt}
            />
          </div>
          <div className="col-12 col-md-9">
            <PostBox
              host={host}
              profile={profile}
              replyStatus={replyStatus}
              onDiscardReply={() => setReplyStatus(undefined)}
              onPostCreated={(status: StatusData) => {
                setCurrentStatuses((previousValue) => [
                  status,
                  ...previousValue
                ])
                setReplyStatus(undefined)
              }}
            />
            <Posts
              currentTime={new Date(currentServerTime)}
              statuses={currentStatuses}
              showActorId
              showActions
              onReply={onReply}
              onPostDeleted={onPostDeleted}
            />
          </div>
        </div>
      </section>
    </main>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
  req,
  res
}) => {
  const [storage, session] = await Promise.all([
    getStorage(),
    unstable_getServerSession(req, res, authOptions)
  ])

  const config = getConfig()
  if (
    !session?.user?.email ||
    !config.allowEmails.includes(session?.user?.email || '') ||
    !storage
  ) {
    return {
      redirect: {
        destination: '/signin',
        permanent: false
      }
    }
  }

  const isAccountExists = await storage.isAccountExists({
    email: session?.user?.email
  })
  if (!isAccountExists) {
    return {
      redirect: {
        destination: '/setup',
        permanent: false
      }
    }
  }

  const actor = await storage.getActorFromEmail({ email: session.user.email })
  if (!actor) {
    return {
      redirect: {
        destination: '/signin',
        permanent: false
      }
    }
  }

  const [statuses, totalPosts, followingCount, followersCount] =
    await Promise.all([
      storage.getStatuses({ actorId: actor.id }),
      storage.getActorStatusesCount({ actorId: actor.id }),
      storage.getActorFollowingCount({ actorId: actor.id }),
      storage.getActorFollowersCount({ actorId: actor.id })
    ])

  return {
    props: {
      host: config.host,
      statuses: statuses.map((item) => item.toJson()),
      currentServerTime: Date.now(),
      profile: getProfileFromActor(actor),
      totalPosts,
      followersCount,
      followingCount
    }
  }
}

export default Page
