'use strict';

class Manager {
	constructor() {
		this.controller = null;
	}
	registerController(controller) {
		this.controller = controller;
	}
}