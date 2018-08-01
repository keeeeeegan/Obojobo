import Common from 'Common'

import EditorUtil from '../util/editor-util'
import APIUtil from '../../viewer/util/api-util'

const { Store } = Common.flux
const { Dispatcher } = Common.flux
const { OboModel } = Common.models

const MODULE_NODE = 'ObojoboDraft.Modules.Module'

class EditorStore extends Store {
	constructor() {
		let item
		let oldNavTargetId
		super('editorstore')

		Dispatcher.on(
			{
				'editor:setContext': payload => {
					this.state.context = payload.value.context
					return this.triggerChange()
				},
				'editor:rebuildMenu': payload => {
					this.buildMenu(payload.value.model)
					this.triggerChange()
				},
				'editor:goto': payload => {
					oldNavTargetId = this.state.navTargetId
					this.gotoItem(this.state.itemsById[payload.value.id])
				},
				'editor:gotoPath': payload => {
					oldNavTargetId = this.state.navTargetId
					this.gotoItem(this.state.itemsByPath[payload.value.path])
				},
				'editor:deleteChild': payload => {
					console.log('Deleting Child')
				},
				'editor:addPage': payload => {
					this.addPage(payload.value.newPage)
				},
				'editor:deletePage': payload => {
					this.deletePage(payload.value.pageId)
				},
				'editor:moveUpPage': payload => {
					this.moveUpPage(payload.value.pageId)
				},
				'editor:moveDownPage': payload => {
					this.moveDownPage(payload.value.pageId)
				},
				'editor:renamePage': payload => {
					this.renamePage(payload.value.pageId, payload.value.name)
				}
			},
			this
		)
	}

	init(model, startingId, startingPath, viewState = {}) {
		this.state = {
			items: {},
			itemsById: {},
			itemsByPath: {},
			itemsByFullPath: {},
			navTargetHistory: [],
			navTargetId: null,
			locked: viewState['nav:isLocked'] != null ? viewState['nav:isLocked'].value : false,
			open: viewState['nav:isOpen'] != null ? viewState['nav:isOpen'].value : true,
			context: 'editor',
			currentModel: null
		}

		this.buildMenu(model)
		EditorUtil.gotoPath(startingPath)

		if (startingId != null) {
			EditorUtil.goto(startingId)
		} else {
			let first = EditorUtil.getFirst(this.state)

			if (first && first.id) EditorUtil.goto(first.id)
		}
	}

	buildMenu(model) {
		this.state.itemsById = {}
		this.state.itemsByPath = {}
		this.state.itemsByFullPath = {}
		this.state.items = this.generateNav(model)
	}

	gotoItem(navItem) {
		if (!navItem) {
			return false
		}

		if (this.state.navTargetId != null) {
			if (this.state.navTargetId === navItem.id) {
				return
			}

			let navTargetModel = EditorUtil.getNavTargetModel(this.state)
			if (navTargetModel && navTargetModel.processTrigger) {
				navTargetModel.processTrigger('onNavExit')
			}
			this.state.navTargetHistory.push(this.state.navTargetId)
		}

		if (navItem.showChildrenOnNavigation) {
			navItem.showChildren = true
		}

		window.history.pushState({}, document.title, navItem.fullFlatPath)
		this.state.navTargetId = navItem.id
		const navModel = EditorUtil.getNavTargetModel(this.state)
		this.state.currentModel = navModel
		console.log(this.state.navTargetId)
		this.triggerChange()
		return true
	}

	generateNav(model, indent) {
		if (!model) return {}

		if (indent == null) {
			indent = ''
		}
		let item = Common.Store.getItemForType(model.get('type'))

		let navItem = null
		if (item.getNavItem != null) {
			navItem = item.getNavItem(model)
		}

		if (navItem == null) {
			navItem = {}
		}

		navItem = Object.assign(
			{
				type: 'hidden',
				label: '',
				path: '',
				showChildren: true,
				showChildrenOnNavigation: true
			},
			navItem
		)

		navItem.flags = []
		navItem.children = []
		navItem.id = model.get('id')
		navItem.fullPath = [].concat(navItem.path).filter(item => item !== '')
		navItem.flags = {
			visited: false,
			complete: false,
			correct: false
		}

		for (let child of Array.from(model.children.models)) {
			let childNavItem = this.generateNav(child, indent + '_')
			navItem.children.push(childNavItem)
			childNavItem.fullPath = navItem.fullPath
				.concat(childNavItem.fullPath)
				.filter(item => item !== '')

			let flatPath = childNavItem.fullPath.join('/')
			childNavItem.flatPath = flatPath
			childNavItem.fullFlatPath = [
				'/editor',
				model.getRoot().get('draftId'),
				flatPath
			].join('/')
			this.state.itemsByPath[flatPath] = childNavItem
			this.state.itemsByFullPath[childNavItem.fullFlatPath] = childNavItem
		}

		this.state.itemsById[model.get('id')] = navItem

		return navItem
	}

	addPage(newPage) {
		const model = OboModel.getRoot()

		// Add the newPage to the content
		const pageModel = OboModel.create(newPage)
		model.children.at(0).children.add(pageModel)

		EditorUtil.rebuildMenu(model)
		EditorUtil.goto(pageModel.id)
	}

	deletePage(pageId) {
		const model = this.state.currentModel.getParentOfType(MODULE_NODE)

		OboModel.models[pageId].remove()

		EditorUtil.rebuildMenu(model)

		this.state.currentModel = null
		this.triggerChange()
	}

	moveUpPage(pageId) {
		const model = OboModel.models[pageId].moveTo()

		EditorUtil.rebuildMenu(model)
		// @TODO what if we delete the last page?, or the start page

		EditorUtil.goto(model.modelState.start)
		this.state.currentModel = null
		this.triggerChange()
	}
}

let editorStore = new EditorStore()
window.__es = editorStore
export default editorStore
