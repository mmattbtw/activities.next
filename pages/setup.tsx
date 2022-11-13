import { GetServerSideProps, NextPage } from 'next'
import Head from 'next/head'
import { unstable_getServerSession } from 'next-auth/next'
import { useSession } from 'next-auth/react'
import { authOptions } from './api/auth/[...nextauth]'

import { Header } from '../lib/components/Header'
import { Button } from '../lib/components/Button'

interface Props {}

const Page: NextPage<Props> = () => {
  const { data: session } = useSession()
  return (
    <main>
      <Head>
        <title>Activities: setup</title>
      </Head>
      <Header session={session} />
      <section className="container pt-4">
        <form>
          <div className="mb-3">
            <label htmlFor="handle" className="form-label">
              Handle
            </label>
            <input
              type="text"
              className="form-control"
              id="handle"
              aria-describedby="handleHelp"
            />
            <div id="handleHelp" className="form-text">
              Handle name that will show before domain.
            </div>
          </div>
          <Button>Submit</Button>
        </form>
      </section>
    </main>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
  req,
  res
}) => {
  const session = await unstable_getServerSession(req, res, authOptions)
  if (!session?.user) {
    return {
      redirect: {
        destination: '/signin',
        permanent: false
      }
    }
  }

  return {
    props: {}
  }
}

export default Page
