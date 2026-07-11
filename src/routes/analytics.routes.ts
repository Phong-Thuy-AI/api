import { Router } from 'express'
import { trackPageView } from '@/controllers/analytics.controller'
import { asyncHandler } from '@/utils/asyncHandler'

const router = Router()

router.post('/page-view', asyncHandler(trackPageView))

export default router
