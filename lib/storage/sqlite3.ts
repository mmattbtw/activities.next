import crypto from 'crypto'
import { Knex, knex } from 'knex'

import { PER_PAGE_LIMIT } from '.'
import { ACTIVITY_STREAM_PUBLIC } from '../jsonld/activitystream'
import { Account } from '../models/account'
import { Actor } from '../models/actor'
import { Attachment, AttachmentData } from '../models/attachment'
import { Follow, FollowStatus } from '../models/follow'
import {
  Status,
  StatusAnnounce,
  StatusNote,
  StatusType
} from '../models/status'
import { Tag, TagData } from '../models/tag'
import { Timeline } from '../timelines/types'
import {
  CreateAccountParams,
  CreateActorParams,
  CreateAnnounceParams,
  CreateAttachmentParams,
  CreateFollowParams,
  CreateLikeParams,
  CreateNoteParams,
  CreateTagParams,
  CreateTimelineStatusParams,
  DeleteActorParams,
  DeleteLikeParams,
  DeleteStatusParams,
  GetAcceptedOrRequestedFollowParams,
  GetAccountFromIdParams,
  GetActorFollowersCountParams,
  GetActorFollowingCountParams,
  GetActorFromEmailParams,
  GetActorFromIdParams,
  GetActorFromUsernameParams,
  GetActorStatusesCountParams,
  GetActorStatusesParams,
  GetAttachmentsParams,
  GetFollowFromIdParams,
  GetFollowersInboxParams,
  GetLikeCountParams,
  GetLocalActorsFromFollowerUrlParams,
  GetLocalFollowersForActorIdParams,
  GetStatusParams,
  GetStatusRepliesParams,
  GetTagsParams,
  GetTimelineParams,
  IsAccountExistsParams,
  IsCurrentActorFollowingParams,
  IsUsernameExistsParams,
  Storage,
  UpdateActorParams,
  UpdateFollowStatusParams
} from './types'

interface ActorSettings {
  iconUrl?: string
  headerImageUrl?: string
  appleSharedAlbumToken?: string
  followersUrl: string
  inboxUrl: string
  sharedInboxUrl: string
}

interface SQLActor {
  id: string
  username: string
  domain: string
  name?: string
  summary?: string
  accountId: string

  publicKey: string
  privateKey: string

  settings: string

  createdAt: number
  updatedAt: number
}

export class Sqlite3Storage implements Storage {
  database: Knex

  constructor(config: Knex.Config) {
    this.database = knex(config)
  }

  async migrate() {
    await this.database.migrate.latest()
  }

  async destroy() {
    await this.database.destroy()
  }

  async isAccountExists({ email }: IsAccountExistsParams) {
    const result = await this.database('accounts')
      .where('email', email)
      .count<{ count: number }>('id as count')
      .first()
    return Boolean(result?.count && result?.count > 0)
  }

  async isUsernameExists({ username, domain }: IsUsernameExistsParams) {
    const response = await this.database('actors')
      .where('username', username)
      .andWhere('domain', domain)
      .count<{ count: number }>('id as count')
      .first()
    return Boolean(response?.count && response?.count > 0)
  }

  async createAccount({
    email,
    username,
    domain,
    privateKey,
    publicKey
  }: CreateAccountParams) {
    const accountId = crypto.randomUUID()
    const actorId = `https://${domain}/users/${username}`
    const currentTime = Date.now()

    const actorSettings: ActorSettings = {
      followersUrl: `${actorId}/followers`,
      inboxUrl: `${actorId}/inbox`,
      sharedInboxUrl: `https://${domain}/inbox`
    }

    await this.database.transaction(async (trx) => {
      await trx('accounts').insert({
        id: accountId,
        email,
        createdAt: currentTime,
        updatedAt: currentTime
      })
      await trx('actors').insert({
        id: actorId,
        accountId,
        username,
        domain,
        settings: JSON.stringify(actorSettings),
        publicKey,
        privateKey,
        createdAt: currentTime,
        updatedAt: currentTime
      })
    })

    return accountId
  }

  async getAccountFromId({ id }: GetAccountFromIdParams) {
    return this.database<Account>('accounts').where('id', id).first()
  }

  async createActor({
    actorId,

    username,
    domain,
    name,
    summary,
    iconUrl,
    headerImageUrl,
    followersUrl,
    inboxUrl,
    sharedInboxUrl,

    publicKey,
    privateKey,

    createdAt
  }: CreateActorParams) {
    const currentTime = Date.now()

    const settings: ActorSettings = {
      iconUrl,
      headerImageUrl,
      followersUrl,
      inboxUrl,
      sharedInboxUrl
    }
    await this.database('actors').insert({
      id: actorId,
      username,
      domain,
      name,
      summary,
      settings: JSON.stringify(settings),
      publicKey,
      privateKey,
      createdAt,
      updatedAt: currentTime
    })
    return this.getActorFromId({ id: actorId })
  }

  private getActor(sqlActor: SQLActor, account?: Account) {
    const settings = JSON.parse(sqlActor.settings || '{}') as ActorSettings
    return new Actor({
      id: sqlActor.id,
      username: sqlActor.username,
      domain: sqlActor.domain,
      ...(sqlActor.name ? { name: sqlActor.name } : null),
      ...(sqlActor.summary ? { summary: sqlActor.summary } : null),
      ...(settings.iconUrl ? { iconUrl: settings.iconUrl } : null),
      ...(settings.headerImageUrl
        ? { headerImageUrl: settings.headerImageUrl }
        : null),
      ...(settings.appleSharedAlbumToken
        ? { appleSharedAlbumToken: settings.appleSharedAlbumToken }
        : null),
      followersUrl: settings.followersUrl,
      inboxUrl: settings.inboxUrl,
      sharedInboxUrl: settings.sharedInboxUrl,
      publicKey: sqlActor.publicKey,
      ...(sqlActor.privateKey ? { privateKey: sqlActor.privateKey } : null),
      ...(account ? { account } : null),
      createdAt: sqlActor.createdAt,
      updatedAt: sqlActor.updatedAt
    })
  }

  async getActorFromEmail({ email }: GetActorFromEmailParams) {
    const storageActor = await this.database('actors')
      .select<SQLActor>('actors.*')
      .leftJoin('accounts', 'actors.accountId', 'accounts.id')
      .where('accounts.email', email)
      .first()
    if (!storageActor) return undefined

    const account = await this.getAccountFromId({ id: storageActor.accountId })
    return this.getActor(storageActor, account)
  }

  async isCurrentActorFollowing({
    currentActorId,
    followingActorId
  }: IsCurrentActorFollowingParams) {
    const result = await this.database('follows')
      .where('actorId', currentActorId)
      .andWhere('targetActorId', followingActorId)
      .andWhere('status', 'Accepted')
      .count<{ count: number }>('id as count')
      .first()
    return Boolean(result?.count && result?.count > 0)
  }

  async getActorFromUsername({ username, domain }: GetActorFromUsernameParams) {
    const storageActor = await this.database<SQLActor>('actors')
      .where('username', username)
      .andWhere('domain', domain)
      .first()
    if (!storageActor) return undefined

    const account = await this.getAccountFromId({ id: storageActor.accountId })
    return this.getActor(storageActor, account)
  }

  async getActorFromId({ id }: GetActorFromIdParams) {
    const storageActor = await this.database<SQLActor>('actors')
      .where('id', id)
      .first()
    if (!storageActor) return undefined

    if (!storageActor.accountId) {
      return this.getActor(storageActor)
    }

    const account = await this.getAccountFromId({ id: storageActor.accountId })
    return this.getActor(storageActor, account)
  }

  async updateActor({
    actorId,
    name,
    summary,
    iconUrl,
    headerImageUrl,
    appleSharedAlbumToken,

    publicKey,

    followersUrl,
    inboxUrl,
    sharedInboxUrl
  }: UpdateActorParams) {
    const storageActor = await this.database<SQLActor>('actors')
      .where('id', actorId)
      .first()
    if (!storageActor) return undefined

    const settings: ActorSettings = {
      ...JSON.parse(storageActor.settings),
      ...(iconUrl ? { iconUrl } : null),
      ...(headerImageUrl ? { headerImageUrl } : null),
      ...(appleSharedAlbumToken ? { appleSharedAlbumToken } : null),

      ...(followersUrl ? { followersUrl } : null),
      ...(inboxUrl ? { inboxUrl } : null),
      ...(sharedInboxUrl ? { sharedInboxUrl } : null)
    }

    await this.database<SQLActor>('actors')
      .where('id', actorId)
      .update({
        ...(name ? { name } : null),
        ...(summary ? { summary } : null),

        ...(publicKey ? { publicKey } : null),

        settings: JSON.stringify(settings),
        updatedAt: Date.now()
      })
    return this.getActorFromId({ id: actorId })
  }

  async deleteActor({ actorId }: DeleteActorParams) {
    await this.database('actors').where('id', actorId).delete()
  }

  async getActorFollowingCount({ actorId }: GetActorFollowingCountParams) {
    const result = await this.database('follows')
      .where('actorId', actorId)
      .andWhere('status', 'Accepted')
      .count<{ count: number }>('* as count')
      .first()
    return result?.count ?? 0
  }

  async getActorFollowersCount({ actorId }: GetActorFollowersCountParams) {
    const result = await this.database('follows')
      .where('targetActorId', actorId)
      .andWhere('status', 'Accepted')
      .count<{ count: number }>('* as count')
      .first()
    return result?.count ?? 0
  }

  async createFollow({
    actorId,
    targetActorId,
    status,
    inbox,
    sharedInbox
  }: CreateFollowParams) {
    const existingFollow = await this.getAcceptedOrRequestedFollow({
      actorId,
      targetActorId
    })
    if (existingFollow) {
      return existingFollow
    }

    const currentTime = Date.now()
    const follow: Follow = {
      id: crypto.randomUUID(),
      actorId,
      actorHost: new URL(actorId).host,
      targetActorId,
      targetActorHost: new URL(targetActorId).host,
      status,
      inbox,
      sharedInbox,
      createdAt: currentTime,
      updatedAt: currentTime
    }
    await this.database('follows').insert({ ...follow, inbox, sharedInbox })
    return follow
  }

  async getFollowFromId({ followId }: GetFollowFromIdParams) {
    return this.database<Follow>('follows').where('id', followId).first()
  }

  async getLocalFollowersForActorId({
    targetActorId
  }: GetLocalFollowersForActorIdParams) {
    const actor = await this.getActorFromId({ id: targetActorId })
    // External actor, all followers are internal
    if (!actor?.privateKey) {
      return this.database<Follow>('follows')
        .where('targetActorId', targetActorId)
        .whereIn('status', [FollowStatus.Accepted])
        .orderBy('createdAt', 'desc')
    }

    const domains = (
      await this.database('actors')
        .whereNotNull('privateKey')
        .select('domain')
        .distinct()
    ).map((item) => item.domain)

    return this.database<Follow>('follows')
      .where('targetActorId', targetActorId)
      .whereIn('actorHost', domains)
      .whereIn('status', [FollowStatus.Accepted])
      .orderBy('createdAt', 'desc')
  }

  async getLocalActorsFromFollowerUrl({
    followerUrl
  }: GetLocalActorsFromFollowerUrlParams) {
    const actor = await this.database('actors')
      .jsonExtract('settings', '$.followersUrl', 'followersUrl')
      .where('followersUrl', followerUrl)
      .select('id')
      .first()
    if (!actor?.id) return []

    const localActors = await this.database('actors')
      .leftJoin('follows', 'follows.actorId', 'actors.id')
      .where('follows.targetActorId', actor.id)
      .where('follows.status', FollowStatus.Accepted)
      .where('actors.privateKey', '<>', '')
      .select('actors.*')
    return Promise.all(
      localActors.map(async (actor) => {
        const account = await this.getAccountFromId({
          id: actor.accountId
        })
        return this.getActor(actor, account)
      })
    )
  }

  async getAcceptedOrRequestedFollow({
    actorId,
    targetActorId
  }: GetAcceptedOrRequestedFollowParams) {
    return this.database<Follow>('follows')
      .where('actorId', actorId)
      .where('targetActorId', targetActorId)
      .whereIn('status', [FollowStatus.Accepted, FollowStatus.Requested])
      .orderBy('createdAt', 'desc')
      .first()
  }

  async getFollowersInbox({ targetActorId }: GetFollowersInboxParams) {
    const follows = await this.database<Follow>('follows')
      .where('targetActorId', targetActorId)
      .where('status', FollowStatus.Accepted)
    return Array.from(
      follows.reduce((inboxes, follow) => {
        if (follow.sharedInbox) inboxes.add(follow.sharedInbox)
        else inboxes.add(follow.inbox)
        return inboxes
      }, new Set<string>())
    )
  }

  async updateFollowStatus({ followId, status }: UpdateFollowStatusParams) {
    await this.database('follows').where('id', followId).update({
      status,
      updatedAt: Date.now()
    })
  }

  async createNote({
    id,
    url,
    actorId,
    text,
    summary = '',
    to,
    cc,
    reply = '',
    createdAt
  }: CreateNoteParams) {
    const currentTime = Date.now()
    const statusCreatedAt = createdAt || currentTime
    const statusUpdatedAt = currentTime

    await this.database.transaction(async (trx) => {
      await trx('statuses').insert({
        id,
        actorId,
        type: StatusType.Note,
        content: JSON.stringify({
          url,
          text,
          summary
        }),
        reply,
        createdAt: statusCreatedAt,
        updatedAt: statusUpdatedAt
      })
      await Promise.all(
        to.map((actorId) =>
          trx('recipients').insert({
            id: crypto.randomUUID(),
            statusId: id,
            actorId,
            type: 'to',

            createdAt: statusUpdatedAt,
            updatedAt: statusUpdatedAt
          })
        )
      )

      await Promise.all(
        cc.map((actorId) =>
          trx('recipients').insert({
            id: crypto.randomUUID(),
            statusId: id,
            actorId,
            type: 'cc',

            createdAt: statusUpdatedAt,
            updatedAt: statusUpdatedAt
          })
        )
      )
    })

    const actor = await this.getActorFromId({ id: actorId })
    return new Status({
      id,
      url,
      actorId,
      actor: actor?.toProfile() || null,
      type: StatusType.Note,
      text,
      summary,
      reply,
      to,
      cc,
      attachments: [],
      tags: [],
      replies: [],
      totalLikes: 0,
      isActorLiked: false,
      isActorAnnounced: false,
      createdAt: statusCreatedAt,
      updatedAt: statusUpdatedAt
    })
  }

  async createAnnounce({
    id,
    actorId,
    to,
    cc,
    originalStatusId,
    createdAt
  }: CreateAnnounceParams) {
    const currentTime = Date.now()
    const statusCreatedAt = createdAt || currentTime
    const statusUpdatedAt = currentTime

    await this.database.transaction(async (trx) => {
      await trx('statuses').insert({
        id,
        actorId,
        type: StatusType.Announce,
        reply: '',
        content: originalStatusId,
        createdAt: statusCreatedAt,
        updatedAt: statusUpdatedAt
      })
      await Promise.all(
        to.map((actorId) =>
          trx('recipients').insert({
            id: crypto.randomUUID(),
            statusId: id,
            actorId,
            type: 'to',

            createdAt: statusUpdatedAt,
            updatedAt: statusUpdatedAt
          })
        )
      )

      await Promise.all(
        cc.map((actorId) =>
          trx('recipients').insert({
            id: crypto.randomUUID(),
            statusId: id,
            actorId,
            type: 'cc',

            createdAt: statusUpdatedAt,
            updatedAt: statusUpdatedAt
          })
        )
      )
    })

    const [originalStatus, actor] = await Promise.all([
      this.getStatus({ statusId: originalStatusId }),
      this.getActorFromId({ id: actorId })
    ])
    const announceData: StatusAnnounce = {
      id,
      actorId,
      actor: actor?.toProfile() || null,
      to,
      cc,
      type: StatusType.Announce,
      originalStatus: originalStatus?.data as StatusNote,

      createdAt: statusUpdatedAt,
      updatedAt: statusUpdatedAt
    }

    return new Status(announceData)
  }

  private async isActorAnnouncedStatus(statusId: string, actorId?: string) {
    if (!actorId) return false

    const result = await this.database('statuses')
      .where('type', StatusType.Announce)
      .where('content', statusId)
      .where('actorId', actorId)
      .count<{ count: number }>('* as count')
      .first()
    if (!result) return false
    return result.count !== 0
  }

  private async getStatusWithAttachmentsFromData(
    data: any,
    currentActorId?: string
  ): Promise<Status> {
    const [to, cc] = await Promise.all([
      this.database('recipients')
        .where('statusId', data.id)
        .andWhere('type', 'to'),
      this.database('recipients')
        .where('statusId', data.id)
        .andWhere('type', 'cc')
    ])

    if (data.type === StatusType.Announce) {
      const originalStatusId = data.content
      const [actor, originalStatus] = await Promise.all([
        this.getActorFromId({ id: data.actorId }),
        this.getStatusWithCurrentActorId(originalStatusId, currentActorId)
      ])

      const announceData: StatusAnnounce = {
        id: data.id,
        actorId: data.actorId,
        actor: actor?.toProfile() || null,
        type: StatusType.Announce,
        to: to.map((item) => item.actorId),
        cc: cc.map((item) => item.actorId),
        originalStatus: originalStatus?.data as StatusNote,

        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      }

      return new Status(announceData)
    }

    const [
      attachments,
      tags,
      replies,
      actor,
      totalLikes,
      isActorLikedStatus,
      isActorAnnouncedStatus
    ] = await Promise.all([
      this.getAttachments({ statusId: data.id }),
      this.getTags({ statusId: data.id }),
      this.database('statuses')
        .select('id')
        .where('reply', data.id)
        .orderBy('createdAt', 'desc'),
      this.getActorFromId({ id: data.actorId }),
      this.database('likes')
        .where('statusId', data.id)
        .count<{ count: number }>('* as count')
        .first(),
      this.isActorLikedStatus(data.id, currentActorId),
      this.isActorAnnouncedStatus(data.id, currentActorId)
    ])

    const repliesNote = (
      await Promise.all(
        replies.map((item) => this.getStatus({ statusId: item.id }))
      )
    )
      .map((item) => (item?.data.type === StatusType.Note ? item.data : null))
      .filter((item): item is StatusNote => Boolean(item))

    const content = JSON.parse(data.content)

    return new Status({
      id: data.id,
      url: content.url,
      to: to.map((item) => item.actorId),
      cc: cc.map((item) => item.actorId),
      actorId: data.actorId,
      actor: actor?.toProfile() || null,
      type: StatusType.Note,
      text: content.text,
      summary: content.summary,
      reply: data.reply,
      replies: repliesNote,
      totalLikes: totalLikes?.count ?? 0,
      isActorLiked: isActorLikedStatus,
      isActorAnnounced: isActorAnnouncedStatus,
      attachments: attachments.map((attachment) => attachment.toJson()),
      tags: tags.map((tag) => tag.toJson()),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    })
  }

  private async getStatusWithCurrentActorId(
    statusId: string,
    currentActorId?: string
  ) {
    const status = await this.database('statuses').where('id', statusId).first()
    if (!status) return

    return this.getStatusWithAttachmentsFromData(status, currentActorId)
  }

  async getStatus({ statusId }: GetStatusParams) {
    return this.getStatusWithCurrentActorId(statusId)
  }

  async getStatusReplies({ statusId }: GetStatusRepliesParams) {
    const statuses = await this.database('statuses')
      .where('reply', statusId)
      .orderBy('createdAt', 'desc')
    return Promise.all(
      statuses.map((status) => this.getStatusWithAttachmentsFromData(status))
    )
  }

  async getTimeline({
    timeline,
    actorId,
    startAfterStatusId
  }: GetTimelineParams) {
    switch (timeline) {
      case Timeline.LocalPublic: {
        const query = this.database('recipients')
          .leftJoin('statuses', 'recipients.statusId', 'statuses.id')
          .leftJoin('actors', 'statuses.actorId', 'actors.id')
          .where('recipients.type', 'to')
          .where('recipients.actorId', ACTIVITY_STREAM_PUBLIC)
          .whereNotNull('actors.privateKey')
          .where('statuses.reply', '')
          .orderBy('recipients.createdAt', 'desc')
          .limit(PER_PAGE_LIMIT)
        const local = await query
        const statuses = (
          await Promise.all(
            local.map((item) => this.getStatus({ statusId: item.statusId }))
          )
        ).filter((item): item is Status => item !== undefined)
        return statuses
      }
      case Timeline.MAIN:
      case Timeline.NOANNOUNCE: {
        if (!actorId) return []
        const limit = PER_PAGE_LIMIT
        const startAfterId = startAfterStatusId
          ? (
              await this.database('timelines')
                .where('actorId', actorId)
                .where('timeline', timeline)
                .where('statusId', startAfterStatusId)
                .select('id')
                .first<{ id: number }>()
            ).id
          : 0

        const statusesId = await (startAfterStatusId
          ? this.database('timelines')
              .where('actorId', actorId)
              .where('timeline', timeline)
              .where('id', '<', startAfterId)
              .select('statusId')
              .orderBy('createdAt', 'desc')
              .limit(limit)
          : this.database('timelines')
              .where('actorId', actorId)
              .where('timeline', timeline)
              .select('statusId')
              .orderBy('createdAt', 'desc')
              .limit(limit))

        const statuses = await Promise.all(
          statusesId
            .map((item) => item.statusId)
            .map((statusId) =>
              this.getStatusWithCurrentActorId(statusId, actorId)
            )
        )

        return statuses.filter(
          (status): status is Status => status !== undefined
        )
      }
      default: {
        return []
      }
    }
  }

  async createTimelineStatus({
    actorId,
    status,
    timeline
  }: CreateTimelineStatusParams): Promise<void> {
    const exists = await this.database('timelines')
      .where('actorId', actorId)
      .andWhere('statusId', status.id)
      .andWhere('timeline', timeline)
      .count<{ count: number }>('* as count')
      .first()
    if (exists && exists.count) return

    return this.database('timelines').insert({
      actorId,
      statusId: status.id,
      statusActorId: status.actorId,
      timeline,
      createdAt: status.createdAt,
      updatedAt: Date.now()
    })
  }

  async getActorStatusesCount({ actorId }: GetActorStatusesCountParams) {
    const result = await this.database('statuses')
      .where('actorId', actorId)
      .count<{ count: number }>('* as count')
      .first()
    return result?.count || 0
  }

  async getActorStatuses({ actorId }: GetActorStatusesParams) {
    const statuses = await this.database('statuses')
      .where('actorId', actorId)
      .andWhere('reply', '')
      .orderBy('createdAt', 'desc')
      .limit(PER_PAGE_LIMIT)
    return Promise.all(
      statuses.map((item) => this.getStatusWithAttachmentsFromData(item))
    )
  }

  async deleteStatus({ statusId }: DeleteStatusParams) {
    const replies = await this.database('statuses')
      .where('reply', statusId)
      .select('id')
    await Promise.all(
      replies.map(({ id }) => this.deleteStatus({ statusId: id }))
    )

    await this.database.transaction(async (trx) => {
      await Promise.all([
        trx('statuses').where('id', statusId).delete(),
        trx('recipients').where('statusId', statusId).delete(),
        trx('tags').where('statusId', statusId).delete(),
        trx('attachments').where('statusId', statusId).delete(),
        trx('timelines').where('statusId', statusId).delete()
      ])
    })
  }

  async createAttachment({
    statusId,
    mediaType,
    url,
    width,
    height,
    name = ''
  }: CreateAttachmentParams): Promise<Attachment> {
    const currentTime = Date.now()
    const data: AttachmentData = {
      id: crypto.randomUUID(),
      statusId,
      type: 'Document',
      mediaType,
      url,
      width,
      height,
      name,
      createdAt: currentTime,
      updatedAt: currentTime
    }
    await this.database('attachments').insert(data)
    return new Attachment(data)
  }

  async getAttachments({ statusId }: GetAttachmentsParams) {
    const data = await this.database<AttachmentData>('attachments').where(
      'statusId',
      statusId
    )
    return data.map((item) => new Attachment(item))
  }

  async createTag({ statusId, name, value }: CreateTagParams): Promise<Tag> {
    const currentTime = Date.now()

    const data: TagData = {
      id: crypto.randomUUID(),
      statusId,
      type: 'mention',
      name,
      value: value || '',
      createdAt: currentTime,
      updatedAt: currentTime
    }
    await this.database('tags').insert(data)
    return new Tag(data)
  }

  async getTags({ statusId }: GetTagsParams) {
    const data = await this.database<TagData>('tags').where(
      'statusId',
      statusId
    )
    return data.map((item) => new Tag(item))
  }

  async createLike({ actorId, statusId }: CreateLikeParams) {
    const status = await this.database('statuses').where('id', statusId).first()
    if (!status) return

    const result = await this.database('likes')
      .where({ actorId, statusId })
      .count<{ count: number }>('* as count')
      .first()
    if (result?.count === 1) {
      return
    }

    await this.database('likes').insert({
      actorId,
      statusId
    })
  }

  async deleteLike({ statusId, actorId }: DeleteLikeParams) {
    await this.database('likes').where({ actorId, statusId }).delete()
  }

  async getLikeCount({ statusId }: GetLikeCountParams) {
    const result = await this.database('likes')
      .where('statusId', statusId)
      .count<{ count: number }>('* as count')
      .first()
    return result?.count ?? 0
  }

  private async isActorLikedStatus(statusId: string, actorId?: string) {
    if (!actorId) return false

    const result = await this.database('likes')
      .where('statusId', statusId)
      .where('actorId', actorId)
      .count<{ count: number }>('* as count')
      .first()
    if (!result) return false
    return result.count !== 0
  }
}
