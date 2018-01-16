import Common from 'Common'

let { Dispatcher } = Common.flux

import QuestionUtil from '../../viewer/util/question-util'

var AssessmentUtil = {
	getAssessmentForModel(state, model) {
		let assessmentModel
		if (model.get('type') === 'ObojoboDraft.Sections.Assessment') {
			assessmentModel = model
		} else {
			assessmentModel = model.getParentOfType('ObojoboDraft.Sections.Assessment')
		}

		if (!assessmentModel) {
			return null
		}

		let assessment = state.assessments[assessmentModel.get('id')]
		if (!assessment) {
			return null
		}

		return assessment
	},

	getLastAttemptScoreForModel(state, model) {
		let assessment = AssessmentUtil.getAssessmentForModel(state, model)
		if (!assessment) {
			return null
		}

		if (assessment.attempts.length === 0) {
			return 0
		}

		return assessment.attempts[assessment.attempts.length - 1].result.attemptScore
	},

	getHighestAttemptScoreForModel(state, model) {
		let assessment = AssessmentUtil.getAssessmentForModel(state, model)
		if (!assessment) {
			return null
		}

		return assessment.attempts
			.map(attempt => attempt.result.attemptScore)
			.reduce((a, b) => Math.max(a, b), 0)
	},

	getLastAttemptScoresForModel(state, model) {
		let assessment = AssessmentUtil.getAssessmentForModel(state, model)
		if (!assessment) {
			return null
		}

		if (assessment.attempts.length === 0) {
			return []
		}

		return assessment.attempts[assessment.attempts.length - 1].result.scores
	},

	getCurrentAttemptForModel(state, model) {
		let assessment = AssessmentUtil.getAssessmentForModel(state, model)
		if (!assessment) {
			return null
		}

		return assessment.current
	},

	getAllAttempts(state, model) {
		return this.getAssessmentForModel(state, model).attempts
	},

	hasAttemptsRemaining(state, model) {
		return this.getAssessmentForModel(state, model).attempts.length < model.modelState.attempts
	},

	// getLastAttemptForModel(state, model) {
	// 	let assessment = AssessmentUtil.getAssessmentForModel(state, model);
	// 	if (!assessment || (assessment.attempts.length === 0)) { return null; }

	// 	return assessment.attempts[assessment.attempts.length - 1];
	// },

	// isCurrentAttemptComplete(assessmentState, questionState, model) {
	// 	console.log(
	// 		'@TODO: Function not working, responses stored by responseId, not by questionId. Do not use this method.'
	// 	)
	// 	let current = AssessmentUtil.getCurrentAttemptForModel(assessmentState, model)
	// 	if (!current) {
	// 		return null
	// 	}

	// 	let models = model.children.at(1).children.models

	// 	return (
	// 		models.filter(function(questionModel) {
	// 			let resp = QuestionUtil.getResponse(questionState, questionModel)
	// 			return resp && resp.set === true
	// 		}).length === models.length
	// 	)
	// },

	getNumberOfAttemptsCompletedForModel(state, model) {
		let assessment = AssessmentUtil.getAssessmentForModel(state, model)
		if (!assessment || assessment.attempts.length === 0) {
			return 0
		}

		return assessment.attempts.length
	},

	getNumCorrect(questionScores) {
		return questionScores.reduce(
			function(acc, questionScore) {
				let n = 0
				if (parseInt(questionScore.score, 10) === 100) {
					n = 1
				}
				return parseInt(acc, 10) + n
			},
			[0]
		)
	},

	startAttempt(model) {
		return Dispatcher.trigger('assessment:startAttempt', {
			value: {
				id: model.get('id')
			}
		})
	},

	endAttempt(model, hasAssessmentReview) {
		return Dispatcher.trigger('assessment:endAttempt', {
			value: {
				id: model.get('id'),
				hasAssessmentReview
			}
		})
	}
}

export default AssessmentUtil
