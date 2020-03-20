const oboEvents = oboRequire('obo_events')
const viewerState = oboRequire('viewer/viewer_state')
const VisitModel = oboRequire('models/visit')
const db = oboRequire('db')
const logger = oboRequire('logger')

oboEvents.on('client:nav:open', event => {
	return setNavOpen(event.userId, event.draftId, event.contentId, true, event.visitId)
})

oboEvents.on('client:nav:close', event => {
	return setNavOpen(event.userId, event.draftId, event.contentId, false, event.visitId)
})

oboEvents.on('client:nav:redAlert:enable', event => {
	return toggleRedAlert(event)
})

oboEvents.on('client:nav:redAlert:disable', event => {
	return toggleRedAlert(event)
})

const toggleRedAlert = event => {
	const userId = event.userId
	const draftId = event.draftId
	const isRedAlertEnabled = event.payload.to
	// const isRedAlertEnabled = 'false'
	const createdAtTime = new Date().toISOString()
	const updatedAtTime = new Date().toISOString()
	return db
		.none(
			`
				INSERT INTO red_alert_status
				(user_id, created_at, updated_at, draft_id, is_enabled)
				VALUES($[userId], $[createdAtTime], $[updatedAtTime], $[draftId], $[isRedAlertEnabled])
				ON CONFLICT (draft_id, user_id) DO UPDATE
				SET is_enabled = $[isRedAlertEnabled], updated_at = $[updatedAtTime]
				WHERE red_alert_status.user_id = $[userId] AND
				red_alert_status.draft_id = $[draftId]
			`,
			{
				userId,
				createdAtTime,
				updatedAtTime,
				draftId,
				isRedAlertEnabled
			}
		)
		.catch(error => {
			logger.error('DB UNEXPECTED on red_alert_status.set', error, error.toString())
		})
}

const setNavOpen = (userId, draftId, contentId, value, visitId) => {
	return VisitModel.fetchById(visitId).then(visit => {
		viewerState.set(userId, draftId, contentId, 'nav:isOpen', 1, value, visit.resource_link_id)
	})
}

module.exports = (req, res, next) => {
	next()
}
