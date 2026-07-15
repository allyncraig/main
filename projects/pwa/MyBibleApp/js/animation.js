'use strict';

function animateOut() {
	const contentArea = document.getElementById(UI.MAINCONTENT);
	if (!contentArea) return Promise.resolve();

	return new Promise(resolve => {
		contentArea.style.transition = 'opacity 0.3s ease';
		contentArea.style.opacity = '0';
		setTimeout(() => resolve(), 300);
	});
}

function animateIn() {
	const contentArea = document.getElementById(UI.MAINCONTENT);
	if (!contentArea) return;

	contentArea.style.transition = 'opacity 0.3s ease';
	contentArea.style.opacity = '1';
}
