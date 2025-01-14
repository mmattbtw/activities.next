import { Settings as FirestoreSetting } from '@google-cloud/firestore'
import fs from 'fs'
import type { Knex } from 'knex'
import memoize from 'lodash/memoize'
import path from 'path'

type KnexBaseDatabase = Knex.Config & { type: 'sqlite3' }
type FirebaseDatabase = FirestoreSetting & { type: 'firebase' }

export interface Config {
  host: string
  database: KnexBaseDatabase | FirebaseDatabase
  allowEmails: string[]
  secretPhase: string
  allowMediaDomains?: string[]
  auth?: {
    github?: {
      id: string
      secret: string
    }
  }
}

export const getConfig = memoize((): Config => {
  try {
    return JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'config.json'), 'utf-8')
    )
  } catch {
    // Fall back to read config from environment variable
    return {
      host: process.env.ACTIVITIES_HOST || '',
      database: JSON.parse(process.env.ACTIVITIES_DATABASE || '{}'),
      secretPhase: process.env.ACTIVITIES_SECRET_PHASE || '',
      allowEmails: JSON.parse(process.env.ACTIVITIES_ALLOW_EMAILS || '[]'),
      allowMediaDomains: JSON.parse(
        process.env.ACTIVITIES_ALLOW_MEDIA_DOMAINS || '[]'
      ),
      auth: JSON.parse(process.env.ACTIVITIES_AUTH || '{}')
    }
  }
})
