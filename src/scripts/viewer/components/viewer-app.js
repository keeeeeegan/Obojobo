import '../../../scss/main.scss'
import './viewer-app.scss'

import Common from 'Common'
import React from 'react'
import IdleTimer from 'react-idle-timer'

import InlineNavButton from '../../viewer/components/inline-nav-button'
import NavUtil from '../../viewer/util/nav-util'
import APIUtil from '../../viewer/util/api-util'
import Logo from '../../viewer/components/logo'
import ScoreStore from '../../viewer/stores/score-store'
import QuestionStore from '../../viewer/stores/question-store'
import AssessmentStore from '../../viewer/stores/assessment-store'
import NavStore from '../../viewer/stores/nav-store'
import Nav from './nav'
import getLTIOutcomeServiceHostname from '../../viewer/util/get-lti-outcome-service-hostname'

const IDLE_TIMEOUT_DURATION_MS = 600000 // 10 minutes

let { Legacy } = Common.models
let { DOMUtil } = Common.page
let { Screen } = Common.page
let { OboModel } = Common.models
let { Dispatcher } = Common.flux
let { ModalContainer } = Common.components
let { SimpleDialog } = Common.components.modal
let { ModalUtil } = Common.util
let { FocusBlocker } = Common.components
let { ModalStore } = Common.stores
let { FocusStore } = Common.stores
let { FocusUtil } = Common.util

// Dispatcher.on 'all', (eventName, payload) -> console.log 'EVENT TRIGGERED', eventName

Dispatcher.on('viewer:alert', payload =>
	ModalUtil.show(
		<SimpleDialog ok title={payload.value.title}>
			{payload.value.message}
		</SimpleDialog>
	)
)

export default class ViewerApp extends React.Component {
	// === REACT LIFECYCLE METHODS ===

	constructor(props) {
		super(props)

		Common.Store.loadDependency('https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.5.1/katex.min.css')

		Dispatcher.on('viewer:scrollTo', payload => {
			return (ReactDOM.findDOMNode(this.refs.container).scrollTop = payload.value)
		})

		Dispatcher.on('viewer:scrollToTop', this.scrollToTop.bind(this))
		Dispatcher.on('getTextForVariable', this.getTextForVariable.bind(this))

		let state = {
			model: null,
			navState: null,
			scoreState: null,
			questionState: null,
			assessmentState: null,
			modalState: null,
			focusState: null,
			navTargetId: null,
			loading: true,
			requestStatus: 'unknown',
			isPreviewing: false,
			lti: {
				outcomeServiceHostname: null
			}
		}
		this.onNavStoreChange = () => this.setState({ navState: NavStore.getState() })
		this.onScoreStoreChange = () => this.setState({ scoreState: ScoreStore.getState() })
		this.onQuestionStoreChange = () => this.setState({ questionState: QuestionStore.getState() })
		this.onAssessmentStoreChange = () =>
			this.setState({ assessmentState: AssessmentStore.getState() })
		this.onModalStoreChange = () => this.setState({ modalState: ModalStore.getState() })
		this.onFocusStoreChange = () => this.setState({ focusState: FocusStore.getState() })

		this.onIdle = this.onIdle.bind(this)
		this.onReturnFromIdle = this.onReturnFromIdle.bind(this)
		this.onBeforeWindowClose = this.onBeforeWindowClose.bind(this)
		this.onWindowClose = this.onWindowClose.bind(this)
		this.onVisibilityChange = this.onVisibilityChange.bind(this)

		window.onbeforeunload = this.onBeforeWindowClose
		window.onunload = this.onWindowClose

		this.state = state
	}

	componentDidMount() {
		document.addEventListener('visibilitychange', this.onVisibilityChange)

		let visitIdFromApi
		let attemptHistory
		let isPreviewing
		let outcomeServiceURL

		let urlTokens = document.location.pathname.split('/')
		let visitIdFromUrl = urlTokens[4] ? urlTokens[4] : null
		let draftIdFromUrl = urlTokens[2] ? urlTokens[2] : null

		Dispatcher.trigger('viewer:loading')

		APIUtil.requestStart(visitIdFromUrl, draftIdFromUrl)
			.then(visit => {
				if (visit.status !== 'ok') throw 'Invalid Visit Id'
				visitIdFromApi = visit.value.visitId
				attemptHistory = visit.value.extensions[':ObojoboDraft.Sections.Assessment:attemptHistory']
				isPreviewing = visit.value.isPreviewing
				outcomeServiceURL = visit.value.lti.lisOutcomeServiceUrl

				return APIUtil.getDraft(draftIdFromUrl)
			})
			.then(({ value: draftModel }) => {
				this.state.model = OboModel.create(draftModel)

				ScoreStore.init()
				QuestionStore.init()
				ModalStore.init()
				FocusStore.init()
				NavStore.init(
					this.state.model,
					this.state.model.modelState.start,
					window.location.pathname,
					visitIdFromApi
				)
				AssessmentStore.init(attemptHistory)

				this.state.navState = NavStore.getState()
				this.state.scoreState = ScoreStore.getState()
				this.state.questionState = QuestionStore.getState()
				this.state.assessmentState = AssessmentStore.getState()
				this.state.modalState = ModalStore.getState()
				this.state.focusState = FocusStore.getState()
				this.state.lti.outcomeServiceHostname = getLTIOutcomeServiceHostname(outcomeServiceURL)

				window.onbeforeunload = this.onWindowClose
				this.setState({ loading: false, requestStatus: 'ok', isPreviewing }, () => {
					Dispatcher.trigger('viewer:loaded', true)
				})
			})
			.catch(err => {
				console.log(err)
				this.setState({ loading: false, requestStatus: 'invalid' }, () =>
					Dispatcher.trigger('viewer:loaded', false)
				)
			})
	}

	componentWillMount() {
		// === SET UP DATA STORES ===
		NavStore.onChange(this.onNavStoreChange)
		ScoreStore.onChange(this.onScoreStoreChange)
		QuestionStore.onChange(this.onQuestionStoreChange)
		AssessmentStore.onChange(this.onAssessmentStoreChange)
		ModalStore.onChange(this.onModalStoreChange)
		FocusStore.onChange(this.onFocusStoreChange)
	}

	componentWillUnmount() {
		NavStore.offChange(this.onNavStoreChange)
		ScoreStore.offChange(this.onScoreStoreChange)
		QuestionStore.offChange(this.onQuestionStoreChange)
		AssessmentStore.offChange(this.onAssessmentStoreChange)
		ModalStore.offChange(this.onModalStoreChange)
		FocusStore.offChange(this.onFocusStoreChange)

		document.removeEventListener('visibilitychange', this.onVisibilityChange)
	}

	shouldComponentUpdate(nextProps, nextState) {
		return !nextState.loading
	}

	componentWillUpdate(nextProps, nextState) {
		if (this.state.requestStatus === 'ok') {
			let navTargetId = this.state.navTargetId
			let nextNavTargetId = this.state.navState.navTargetId

			if (navTargetId !== nextNavTargetId) {
				this.needsScroll = true
				return this.setState({ navTargetId: nextNavTargetId })
			}
		}
	}

	componentDidUpdate() {
		if (this.state.requestStatus === 'ok') {
			if (this.lastCanNavigate !== NavUtil.canNavigate(this.state.navState)) {
				this.needsScroll = true
			}
			this.lastCanNavigate = NavUtil.canNavigate(this.state.navState)
			if (this.needsScroll != null) {
				this.scrollToTop()

				return delete this.needsScroll
			}
		}
	}

	onVisibilityChange(event) {
		if (document.hidden) {
			APIUtil.postEvent(this.state.model, 'viewer:leave', '1.0.0', {}).then(res => {
				this.leaveEvent = res.value
			})
		} else {
			APIUtil.postEvent(this.state.model, 'viewer:return', '1.0.0', {
				relatedEventId: this.leaveEvent.id
			})
			delete this.leaveEvent
		}
	}

	getTextForVariable(event, variable, textModel) {
		return (event.text = Common.Store.getTextForVariable(variable, textModel, this.state))
	}

	scrollToTop() {
		let el = ReactDOM.findDOMNode(this.refs.prev)
		let container = ReactDOM.findDOMNode(this.refs.container)

		if (!container) return

		if (el) {
			return (container.scrollTop = ReactDOM.findDOMNode(el).getBoundingClientRect().height)
		} else {
			return (container.scrollTop = 0)
		}
	}

	// === NON REACT LIFECYCLE METHODS ===

	update(json) {
		try {
			let o
			return (o = JSON.parse(json))
		} catch (e) {
			alert('Error parsing JSON')
			this.setState({ model: this.state.model })
			return
		}
	}

	onBack() {
		return NavUtil.goPrev()
	}

	onNext() {
		return NavUtil.goNext()
	}

	onMouseDown(event) {
		if (this.state.focusState.focussedId == null) {
			return
		}
		if (!DOMUtil.findParentComponentIds(event.target).has(this.state.focusState.focussedId)) {
			return FocusUtil.unfocus()
		}
	}

	onScroll(event) {
		if (this.state.focusState.focussedId == null) {
			return
		}

		let component = FocusUtil.getFocussedComponent(this.state.focusState)
		if (component == null) {
			return
		}

		let el = component.getDomEl()
		if (!el) {
			return
		}

		if (!Screen.isElementVisible(el)) {
			return FocusUtil.unfocus()
		}
	}

	onIdle() {
		this.lastActiveEpoch = new Date(this.refs.idleTimer.getLastActiveTime())

		APIUtil.postEvent(this.state.model, 'viewer:inactive', '1.0.0', {
			lastActiveTime: this.lastActiveEpoch,
			inactiveDuration: IDLE_TIMEOUT_DURATION_MS
		}).then(res => {
			this.inactiveEvent = res.value
		})
	}

	onReturnFromIdle() {
		APIUtil.postEvent(this.state.model, 'viewer:returnFromInactive', '1.0.0', {
			lastActiveTime: this.lastActiveEpoch,
			inactiveDuration: Date.now() - this.lastActiveEpoch,
			relatedEventId: this.inactiveEvent.id
		})

		delete this.lastActiveEpoch
		delete this.inactiveEvent
	}

	onBeforeWindowClose(e) {
		let closePrevented = false
		let preventClose = () => (closePrevented = true)

		Dispatcher.trigger('viewer:closeAttempted', preventClose)

		if (closePrevented) {
			return true // Returning true will cause browser to ask user to confirm leaving page
		}

		return undefined // Returning undefined will allow browser to close normally
	}

	onWindowClose(e) {
		APIUtil.postEvent(this.state.model, 'viewer:close', '1.0.0', {})
	}

	resetAssessments() {
		AssessmentStore.init()
		QuestionStore.init()
		ScoreStore.init()

		AssessmentStore.triggerChange()
		QuestionStore.triggerChange()
		ScoreStore.triggerChange()

		return ModalUtil.show(
			<SimpleDialog ok width="15em">
				Assessment attempts and all question responses have been reset.
			</SimpleDialog>
		)
	}

	unlockNavigation() {
		return NavUtil.unlock()
	}

	render() {
		// @TODO loading component
		if (this.state.loading == true) {
			return <div className="is-loading">...Loading</div>
		}

		if (this.state.requestStatus === 'invalid') return <div>Invalid</div>

		let nextEl, nextModel, prevEl
		window.__lo = this.state.model
		window.__s = this.state

		let ModuleComponent = this.state.model.getComponentClass()

		let navTargetModel = NavUtil.getNavTargetModel(this.state.navState)
		let navTargetTitle = '?'
		if (navTargetModel != null) {
			navTargetTitle = navTargetModel.title
		}

		let prevModel = (nextModel = null)
		if (NavUtil.canNavigate(this.state.navState)) {
			prevModel = NavUtil.getPrevModel(this.state.navState)
			if (prevModel) {
				prevEl = <InlineNavButton ref="prev" type="prev" title={`Back: ${prevModel.title}`} />
			} else {
				prevEl = (
					<InlineNavButton
						ref="prev"
						type="prev"
						title={`Start of ${this.state.model.title}`}
						disabled
					/>
				)
			}

			nextModel = NavUtil.getNextModel(this.state.navState)
			if (nextModel) {
				nextEl = <InlineNavButton ref="next" type="next" title={`Next: ${nextModel.title}`} />
			} else {
				nextEl = (
					<InlineNavButton
						ref="next"
						type="next"
						title={`End of ${this.state.model.title}`}
						disabled
					/>
				)
			}
		}

		let modalItem = ModalUtil.getCurrentModal(this.state.modalState)
		let hideViewer = modalItem && modalItem.hideViewer

		return (
			<IdleTimer
				ref="idleTimer"
				element={window}
				timeout={IDLE_TIMEOUT_DURATION_MS}
				idleAction={this.onIdle}
				activeAction={this.onReturnFromIdle}
			>
				<div
					ref="container"
					onMouseDown={this.onMouseDown.bind(this)}
					onScroll={this.onScroll.bind(this)}
					className={`viewer--viewer-app${
						this.state.isPreviewing ? ' is-previewing' : ' is-not-previewing'
					}${this.state.navState.locked ? ' is-locked-nav' : ' is-unlocked-nav'}${
						this.state.navState.open ? ' is-open-nav' : ' is-closed-nav'
					}${
						this.state.navState.disabled ? ' is-disabled-nav' : ' is-enabled-nav'
					} is-focus-state-${this.state.focusState.viewState}`}
				>
					{hideViewer ? null : (
						<header>
							<div className="pad">
								<span className="module-title">{this.state.model.title}</span>
								<span className="location">{navTargetTitle}</span>
								<Logo />
							</div>
						</header>
					)}
					{hideViewer ? null : <Nav navState={this.state.navState} />}
					{hideViewer ? null : prevEl}
					{hideViewer ? null : <ModuleComponent model={this.state.model} moduleData={this.state} />}
					{hideViewer ? null : nextEl}
					{this.state.isPreviewing ? (
						<div className="preview-banner">
							<span>You are previewing this object - Assessments will not be counted</span>
							<div className="controls">
								<button
									onClick={this.unlockNavigation.bind(this)}
									disabled={!this.state.navState.locked}
								>
									Unlock navigation
								</button>
								<button onClick={this.resetAssessments.bind(this)}>
									Reset assessments &amp; questions
								</button>
							</div>
						</div>
					) : null}
					<FocusBlocker moduleData={this.state} />
					{modalItem && modalItem.component ? (
						<ModalContainer>{modalItem.component}</ModalContainer>
					) : null}
				</div>
			</IdleTimer>
		)
	}
}