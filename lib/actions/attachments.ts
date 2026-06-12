'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId, requiredString, ActionError } from './helpers'
import type { AttachmentEntityType } from '@/lib/supabase/types/database'

const MAX_FILE_BYTES = 10 * 1024 * 1024

export async function uploadAttachment(formData: FormData) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const entityType = requiredString(formData, 'entity_type') as AttachmentEntityType
  const entityId = requiredString(formData, 'entity_id')
  const revalidate = requiredString(formData, 'revalidate_path')
  const file = formData.get('file')

  if (!(file instanceof File) || file.size === 0) {
    throw new ActionError('No file provided')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ActionError('File exceeds 10 MB limit')
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { contentType: file.type || undefined })

  if (uploadError) throw new ActionError(`Upload failed: ${uploadError.message}`)

  const { error: insertError } = await supabase.from('bio_attachments').insert({
    entity_type: entityType,
    entity_id: entityId,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: memberId,
  })

  if (insertError) {
    await supabase.storage.from('documents').remove([storagePath])
    throw new ActionError(`Failed to record attachment: ${insertError.message}`)
  }

  revalidatePath(revalidate)
}

export async function deleteAttachment(attachmentId: string, revalidate: string) {
  await requireMemberId()
  const supabase = await createClient()

  const { data: attachment, error } = await supabase
    .from('bio_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .single()

  if (error || !attachment) throw new ActionError('Attachment not found')

  await supabase.storage.from('documents').remove([attachment.storage_path])
  await supabase.from('bio_attachments').delete().eq('id', attachmentId)

  revalidatePath(revalidate)
}

/** Short-lived signed URL for viewing a stored file */
export async function getSignedFileUrl(storagePath: string, bucket: 'documents' | 'letters' = 'documents') {
  await requireMemberId()
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 10)

  if (error || !data) throw new ActionError('Could not create signed URL')
  return data.signedUrl
}
