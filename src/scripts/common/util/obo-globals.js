let GLOBAL_KEY = '__oboGlobals'
let globals = new Map()

export default {
	get(key) {
		if (globals.has(key)) return globals.get(key)
		if (typeof window[GLOBAL_KEY][key] === 'undefined') throw 'No Obo Global found for key ' + key

		globals.set(key, window[GLOBAL_KEY][key])

		delete window[GLOBAL_KEY][key]

		return globals.get(key)
	}
}
