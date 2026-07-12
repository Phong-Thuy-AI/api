import { Request, Response } from 'express'
import { AnalyticsPageView } from '@/models'
import { sendSuccess } from '@/utils/response'

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function normalizePath(value: unknown): string {
  const raw = cleanText(value, 255) || '/'
  if (!raw.startsWith('/')) return `/${raw}`
  return raw
}

export async function trackPageView(req: Request, res: Response) {
  const path = normalizePath(req.body.path)
  if (path.startsWith('/admin')) {
    return sendSuccess(res, { tracked: false }, 'Admin page views are ignored.')
  }

  const visitorId = cleanText(req.body.visitorId, 80)
  const sessionId = cleanText(req.body.sessionId, 80)

  if (!visitorId || !sessionId) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'visitorId and sessionId are required.'
    }
  }

  await AnalyticsPageView.create({
    visitorId,
    sessionId,
    path,
    referrer: cleanText(req.body.referrer || req.get('referer'), 500),
    userAgent: cleanText(req.body.userAgent || req.get('user-agent'), 255)
  })

  return sendSuccess(res, { tracked: true }, 'Page view tracked.')
}
