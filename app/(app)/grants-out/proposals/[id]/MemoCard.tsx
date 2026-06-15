'use client'

import { useState, useTransition } from 'react'
import { startMemo, updateMemo } from '@/lib/actions/grants-out'
import { MEMO_RUBRIC_FIELDS, type MemoRubricKey } from '@/lib/grants/memo'
import { useToast } from '@/components/Toast'
import type { ProposalMemo } from '@/lib/supabase/types/database'

type AnswerMap = Partial<Record<MemoRubricKey, string>>

function answersFromMemo(memo: ProposalMemo | null): AnswerMap {
  const out: AnswerMap = {}
  if (!memo) return out
  for (const [key] of MEMO_RUBRIC_FIELDS) {
    const value = memo[key]
    if (typeof value === 'string') out[key] = value
  }
  return out
}

export default function MemoCard({
  proposalId,
  memo,
  startedByName,
  lastEditedByName,
}: {
  proposalId: string
  memo: ProposalMemo | null
  startedByName: string | null
  lastEditedByName: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [answers, setAnswers] = useState<AnswerMap>(answersFromMemo(memo))
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const answered = MEMO_RUBRIC_FIELDS.reduce(
    (acc, [key]) => acc + ((answers[key] ?? '').trim().length > 0 ? 1 : 0),
    0
  )
  const total = MEMO_RUBRIC_FIELDS.length
  const complete = answered === total

  const handleStart = () => {
    startTransition(async () => {
      try {
        await startMemo(proposalId)
        setEditing(true)
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not start memo', 'error')
      }
    })
  }

  const handleSave = () => {
    const formData = new FormData()
    for (const [key] of MEMO_RUBRIC_FIELDS) {
      formData.set(key, answers[key] ?? '')
    }
    startTransition(async () => {
      try {
        await updateMemo(proposalId, formData)
        setEditing(false)
        showToast('Memo saved', 'success')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not save memo', 'error')
      }
    })
  }

  const handleCancel = () => {
    setAnswers(answersFromMemo(memo))
    setEditing(false)
  }

  if (!memo) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">Evaluation memo</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          A shared memo with 15 rubric prompts. All questions must be answered before a decision
          can be recorded.
        </p>
        <button
          type="button"
          onClick={handleStart}
          disabled={isPending}
          className="btn btn-primary"
        >
          {isPending ? 'Starting…' : 'Start evaluation memo'}
        </button>
      </div>
    )
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-medium text-gray-900">Evaluation memo</h3>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs tabular-nums ${
              complete ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {answered}/{total} answered
          </span>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn btn-secondary text-xs"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Started by {startedByName ?? 'unknown'} · Last edited by{' '}
        {lastEditedByName ?? 'unknown'}
      </p>

      {editing ? (
        <div className="space-y-5">
          {MEMO_RUBRIC_FIELDS.map(([key, prompt]) => (
            <div key={key}>
              <label
                htmlFor={`memo-${key}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                {prompt}
              </label>
              <textarea
                id={`memo-${key}`}
                rows={3}
                value={answers[key] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [key]: e.target.value }))}
                disabled={isPending}
                className="input"
              />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="btn btn-primary"
            >
              {isPending ? 'Saving…' : 'Save memo'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <dl className="space-y-4">
          {MEMO_RUBRIC_FIELDS.map(([key, prompt]) => {
            const value = (answers[key] ?? '').trim()
            return (
              <div key={key}>
                <dt className="text-xs font-medium text-gray-700">{prompt}</dt>
                <dd
                  className={`text-sm mt-0.5 whitespace-pre-wrap ${
                    value ? 'text-gray-900' : 'text-gray-400 italic'
                  }`}
                >
                  {value || 'Not yet answered'}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </div>
  )
}
