/* eslint-disable camelcase */
import cn from 'classnames'
import { GetServerSideProps, NextPage } from 'next'
import { unstable_getServerSession } from 'next-auth/next'
import { useSession } from 'next-auth/react'
import Head from 'next/head'
import Image from 'next/image'

import { Button } from '../lib/components/Button'
import { Header } from '../lib/components/Header'
import { getConfig } from '../lib/config'
import { Actor, getUsernameFromId } from '../lib/models/actor'
import { getStorage } from '../lib/storage'
import { authOptions } from './api/auth/[...nextauth]'
import styles from './profile.module.scss'

interface Props {
  actor: Actor
}

const Page: NextPage<Props> = ({ actor }) => {
  const { data: session } = useSession()

  return (
    <main>
      <Head>
        <title>Activities: profile</title>
      </Head>
      <Header session={session} />
      <section className="container pt-4">
        <div className="row">
          <div className="col-12 col-md-3">
            {actor.iconUrl && (
              <Image
                width={100}
                height={100}
                alt="Actor icon"
                className={cn(styles.icon, 'me-4', 'mb-2', 'flex-shrink-0')}
                src={actor.iconUrl}
              />
            )}
            <div>
              <h1>{actor.name}</h1>
              <h4>@{getUsernameFromId(actor.id)}</h4>
              {Number.isInteger(actor.createdAt) && (
                <p>
                  Joined{' '}
                  {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'long',
                    timeStyle: 'short'
                  }).format(new Date(actor.createdAt))}
                </p>
              )}
            </div>
          </div>
          <div className="col-12 col-md-9">
            <form action="/api/v1/accounts/profile" method="post">
              <div className="mb-3">
                <label htmlFor="nameInput" className="form-label">
                  Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="nameInput"
                  name="name"
                  aria-describedby="nameHelp"
                  defaultValue={actor.name}
                />
                <div id="nameHelp" className="form-text">
                  Name that you want to show in profile
                </div>
              </div>
              <div className="mb-3">
                <label htmlFor="summaryInput" className="form-label">
                  Summary
                </label>
                <textarea
                  rows={3}
                  className="form-control"
                  name="summary"
                  id="summaryInput"
                  defaultValue={actor.summary || ''}
                />
              </div>
              <div className="mb-3">
                <label htmlFor="iconInput" className="form-label">
                  Icon Image URL
                </label>
                <input
                  type="text"
                  className="form-control"
                  name="iconUrl"
                  id="iconInput"
                  aria-describedby="iconHelp"
                  defaultValue={actor.iconUrl}
                />
                <div id="iconHelp" className="form-text">
                  Image URL for profile
                </div>
              </div>
              <div className="mb-3">
                <label htmlFor="headerImageInput" className="form-label">
                  Header Image URL
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="headerImageInput"
                  name="headerImageUrl"
                  aria-describedby="iconHelp"
                  defaultValue={actor.headerImageUrl}
                />
                <div id="headerImageInput" className="form-text">
                  Image URL for profile header
                </div>
              </div>
              <Button type="submit" variant="primary">
                Update
              </Button>
            </form>
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

  const actor = await storage.getActorFromEmail({ email: session.user.email })
  if (!actor) {
    return {
      redirect: {
        destination: '/signin',
        permanent: false
      }
    }
  }

  return {
    props: {
      actor
    }
  }
}

export default Page
