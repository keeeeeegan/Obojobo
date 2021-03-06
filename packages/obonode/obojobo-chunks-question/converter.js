import Common from 'obojobo-document-engine/src/scripts/common'
import Component from 'obojobo-document-engine/src/scripts/oboeditor/components/node/editor'
import withoutUndefined from 'obojobo-document-engine/src/scripts/common/util/without-undefined'

const SOLUTION_NODE = 'ObojoboDraft.Chunks.Question.Solution'
const MCASSESSMENT_NODE = 'ObojoboDraft.Chunks.MCAssessment'
const PAGE_NODE = 'ObojoboDraft.Pages.Page'

const slateToObo = node => {
	const children = []
	const content = node.data.get('content') || {}
	delete content.solution

	node.nodes.forEach(child => {
		switch (child.type) {
			case SOLUTION_NODE:
				content.solution = Common.Registry.getItemForType(PAGE_NODE).slateToObo(child.nodes.get(0))
				break

			case MCASSESSMENT_NODE:
				children.push(Common.Registry.getItemForType(child.type).slateToObo(child))
				break

			default:
				children.push(Component.helpers.slateToObo(child))
				break
		}
	})

	return {
		id: node.key,
		type: node.type,
		children,
		content: withoutUndefined(content)
	}
}

const oboToSlate = node => {
	const nodes = []
	const content = node.content

	node.children.forEach(child => {
		if (child.type === MCASSESSMENT_NODE) {
			nodes.push(Common.Registry.getItemForType(child.type).oboToSlate(child))
		} else {
			nodes.push(Component.helpers.oboToSlate(child))
		}
	})

	if (content.solution) {
		const solution = {
			object: 'block',
			type: SOLUTION_NODE,
			nodes: []
		}

		solution.nodes.push(Common.Registry.getItemForType(PAGE_NODE).oboToSlate(content.solution))
		nodes.push(solution)
	}

	return {
		object: 'block',
		key: node.id,
		type: node.type,
		nodes,
		data: {
			content
		}
	}
}

export default { slateToObo, oboToSlate }
