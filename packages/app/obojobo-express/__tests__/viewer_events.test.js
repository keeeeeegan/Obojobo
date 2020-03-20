jest.mock('../config')
jest.mock('../viewer/viewer_state', () => ({ set: jest.fn() }))
jest.mock('../obo_events', () => ({ on: jest.fn(), emit: jest.fn() }))
jest.mock('../models/visit')
jest.mock('../db')
jest.mock('../logger')

const mockEvent = {
	userId: 'mockUserId',
	draftId: 'mockDraftId',
	contentId: 'mockContentId',
	visitId: 'mockVisitId',
	payload: {
		open: 'yep'
	}
}
let vs
let ve
let oboEvents
let VisitModel
let db
let logger

describe('viewer events', () => {
	beforeAll(() => {})
	afterAll(() => {})
	beforeEach(() => {
		jest.resetModules()
		vs = oboRequire('viewer/viewer_state')
		oboEvents = oboRequire('obo_events')
		VisitModel = oboRequire('models/visit')
		db = oboRequire('db')
		logger = oboRequire('logger')
	})
	afterEach(() => {})

	test('registers expected events', () => {
		expect(oboEvents.on).not.toBeCalled()

		ve = oboRequire('viewer_events')
		expect(oboEvents.on).toBeCalledWith('client:nav:open', expect.any(Function))
		expect(oboEvents.on).toBeCalledWith('client:nav:close', expect.any(Function))
		expect(oboEvents.on).toBeCalledWith('client:nav:redAlert:enable', expect.any(Function))
		expect(oboEvents.on).toBeCalledWith('client:nav:redAlert:disable', expect.any(Function))
		expect(oboEvents.on).toHaveBeenCalledTimes(4)
	})

	test('executes next when included to support express middleware', () => {
		ve = oboRequire('viewer_events')
		const mockNext = jest.fn()
		ve({}, {}, mockNext)
		expect(mockNext).toBeCalled()
	})

	test('client:nav:open', () => {
		expect.hasAssertions()
		ve = oboRequire('viewer_events')

		const [eventName, callback] = oboEvents.on.mock.calls[0]
		expect(eventName).toBe('client:nav:open')
		expect(callback).toHaveLength(1) // callback has 1 argument

		VisitModel.fetchById.mockResolvedValueOnce({
			resource_link_id: 'mockResourceLinkId'
		})

		expect(vs.set).not.toHaveBeenCalled()
		return callback(mockEvent).then(() => {
			expect(vs.set).toBeCalledWith(
				'mockUserId',
				'mockDraftId',
				'mockContentId',
				'nav:isOpen',
				1,
				true,
				'mockResourceLinkId'
			)
		})
	})

	test('client:nav:close', () => {
		expect.hasAssertions()
		ve = oboRequire('viewer_events')

		const [eventName, callback] = oboEvents.on.mock.calls[1]
		expect(eventName).toBe('client:nav:close')
		expect(callback).toHaveLength(1) // callback has 1 argument

		VisitModel.fetchById.mockResolvedValueOnce({
			resource_link_id: 'mockResourceLinkId'
		})

		expect(vs.set).not.toHaveBeenCalled()
		return callback(mockEvent).then(() => {
			expect(vs.set).toBeCalledWith(
				'mockUserId',
				'mockDraftId',
				'mockContentId',
				'nav:isOpen',
				1,
				false,
				'mockResourceLinkId'
			)
		})
	})

	test('client:nav:redAlert:enable', () => {
		expect.hasAssertions()
		ve = oboRequire('viewer_events')

		const [eventName, callback] = oboEvents.on.mock.calls[2]
		expect(eventName).toBe('client:nav:redAlert:enable')
		expect(callback).toHaveLength(1) // callback has 1 argument

		db.none.mockResolvedValueOnce({
			test: 'test'
		})

		expect(vs.set).not.toHaveBeenCalled()
		return callback(mockEvent).then(() => {
			expect(db.none).toBeCalled()
		})
	})

	test('client:nav:redAlert:disable', () => {
		expect.hasAssertions()
		ve = oboRequire('viewer_events')

		const [eventName, callback] = oboEvents.on.mock.calls[3]
		expect(eventName).toBe('client:nav:redAlert:disable')
		expect(callback).toHaveLength(1) // callback has 1 argument

		db.none.mockResolvedValueOnce({
			test: 'test'
		})

		expect(vs.set).not.toHaveBeenCalled()
		return callback(mockEvent).then(() => {
			expect(db.none).toBeCalled()
		})
	})

	test('client:nav:redAlert:disable error', () => {
		expect.assertions(4)
		oboRequire('viewer_events')

		const [eventName, callback] = oboEvents.on.mock.calls[3]
		expect(eventName).toBe('client:nav:redAlert:disable')
		expect(callback).toHaveLength(1) // callback has 1 argument

		db.none.mockRejectedValueOnce('snail')

		const testPayload = { payload: { to: 'banana' } }

		expect(logger.error).not.toHaveBeenCalled()

		return callback(testPayload).then(() => {
			expect(logger.error).toBeCalled()
		})
	})
})
