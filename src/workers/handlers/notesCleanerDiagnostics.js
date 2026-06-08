/**
 * @param {unknown} err
 */
export function errorMessage(err) {
  if (err instanceof Error) {
    const cause =
      err.cause instanceof Error
        ? err.cause.message
        : err.cause != null
          ? String(err.cause)
          : ''
    return cause ? `${err.message} (cause: ${cause})` : err.message
  }
  return String(err)
}

/**
 * @param {string} step
 * @param {unknown} err
 */
export function formatStepFailure(step, err) {
  return `${step} failed: ${errorMessage(err)}`
}

/**
 * @param {number} jobId
 * @param {string} label
 * @param {(payload: object) => void} [postLog]
 */
export function createImageLogger(jobId, label, postLog) {
  /** @type {{ step: string, status: string, detail: object, at: number }[]} */
  const entries = []

  function log(step, status, detail = {}) {
    const entry = { step, status, detail, at: Date.now() }
    entries.push(entry)

    const detailText =
      Object.keys(detail).length > 0 ? ` ${JSON.stringify(detail)}` : ''
    console.log(
      `[NotesCleaner] job=${jobId} image="${label}" step=${step} status=${status}${detailText}`,
    )

    postLog?.({ jobId, label, step, status, detail })
    return entry
  }

  return {
    entries,
    log,
    /**
     * @template T
     * @param {string} step
     * @param {() => T | Promise<T>} fn
     * @param {(result: T) => object} [successDetail]
     */
    async run(step, fn, successDetail) {
      log(step, 'start')
      try {
        const result = await fn()
        log(step, 'success', successDetail?.(result) ?? {})
        return result
      } catch (err) {
        const message = formatStepFailure(step, err)
        log(step, 'failure', { error: message })
        throw new Error(message, { cause: err })
      }
    },
  }
}

/**
 * @param {{
 *   expectedCount: number
 *   appendReceived: number
 *   appendSucceeded: number
 *   appendFailures: number
 *   pageCount: number
 *   appendInProgress: boolean
 *   lastAppendError: string | null
 *   lastImageLogs: object[] | null
 * }} session
 */
export function buildFinishDiagnostic(session) {
  const summary = [
    `expected=${session.expectedCount}`,
    `appendReceived=${session.appendReceived}`,
    `appendSucceeded=${session.appendSucceeded}`,
    `appendFailures=${session.appendFailures}`,
    `pageCount=${session.pageCount}`,
  ]

  if (session.appendInProgress) {
    summary.push('appendInProgress=true')
  }

  if (session.appendReceived === 0) {
    return [
      'FINISH ran before any APPEND was processed (worker message race).',
      `Diagnostics: ${summary.join(', ')}.`,
      'Check worker logs for notesCleaner:start timing.',
    ].join(' ')
  }

  if (session.lastAppendError) {
    return [
      `All image processing attempts failed. Last error: ${session.lastAppendError}`,
      `Diagnostics: ${summary.join(', ')}.`,
      session.lastImageLogs?.length
        ? `Last image steps: ${JSON.stringify(session.lastImageLogs)}`
        : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (session.appendInProgress) {
    return [
      'FINISH ran while an APPEND was still in progress (worker message race).',
      `Diagnostics: ${summary.join(', ')}.`,
    ].join(' ')
  }

  return [
    'No pages were added to the PDF.',
    `Diagnostics: ${summary.join(', ')}.`,
    session.lastImageLogs?.length
      ? `Last image steps: ${JSON.stringify(session.lastImageLogs)}`
      : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * @returns {{
 *   pdf: null
 *   pageCount: number
 *   expectedCount: number
 *   appendReceived: number
 *   appendSucceeded: number
 *   appendFailures: number
 *   appendInProgress: boolean
 *   lastAppendError: string | null
 *   lastImageLogs: object[] | null
 * }}
 */
export function createSessionState(expectedCount = 0) {
  return {
    pdf: null,
    pageCount: 0,
    expectedCount,
    appendReceived: 0,
    appendSucceeded: 0,
    appendFailures: 0,
    appendInProgress: false,
    lastAppendError: null,
    lastImageLogs: null,
  }
}
