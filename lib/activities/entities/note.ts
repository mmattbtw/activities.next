import { ContextEntity } from './base'
import { Collection } from './collection'
import { Document } from './document'
import { Mention } from './mention'
import { PropertyValue } from './propertyValue'

export type Attachment = PropertyValue | Document

export const NoteEntity = 'Note'
export type NoteEntity = typeof NoteEntity

export interface BaseNote extends ContextEntity {
  id: string
  summary?: string
  summaryMap?: {
    [key in string]: string
  }
  inReplyTo: string | null
  published: string
  url?: string
  attributedTo: string
  to: string | string[]
  cc: string | string[]
  content?: string
  contentMap?: {
    [key in string]: string
  }
  attachment: Attachment | Attachment[]
  tag: Mention[]
  replies?: Collection
}

export interface Note extends BaseNote {
  type: 'Note'
}

export const getAttachments = (object: Note) => {
  if (!object.attachment) return []
  if (Array.isArray(object.attachment)) return object.attachment
  return [object.attachment]
}

export const getTags = (object: Note) => {
  if (!object.tag) return []
  if (Array.isArray(object.tag)) return object.tag
  return [object.tag]
}

export const getContent = (object: Note) => {
  if (object.content) return object.content
  if (object.contentMap) {
    const keys = Object.keys(object.contentMap)
    if (keys.length === 0) return ''

    const key = Object.keys(object.contentMap)[0]
    return object.contentMap[key]
  }
  return ''
}

export const getSummary = (object: Note) => {
  if (object.summary) return object.summary
  if (object.summaryMap) {
    const keys = Object.keys(object.summaryMap)
    if (keys.length === 0) return ''

    const key = Object.keys(object.summaryMap)[0]
    return object.summaryMap[key]
  }
  return ''
}
