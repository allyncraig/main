'use strict';

class VersionSelectorManager extends Manager {
	constructor(versionManager, navigationManager, configManager, modalManager) {
		super();
		this.versionManager = versionManager;
		this.navigationManager = navigationManager;
		this.configManager = configManager;
		this.modalManager = modalManager;
		this.interlinearPrimaryVersion = null;
	}

	async showVersionSelector() {
		// console.log('showVersionSelector()');
		if (this.configManager.getValue('interlinearMode')) {
			document.getElementById('versionInterlinearButton').classList.add(CLASS.SELECTED);
		} else {
			document.getElementById('versionInterlinearButton').classList.remove(CLASS.SELECTED);
		}

		// Check if both required versions are available
		const primaryVersionAbbr = this.configManager.getValue('interlinearPrimaryVersion') || APP.INTERLINEAR_FALLBACK_PRIMARY;
		const versionList = await this.getAvailableVersions();
		const hasPrimary = versionList.some(v => v.abbreviation === primaryVersionAbbr);
		const hasABT = versionList.some(v => v.abbreviation === 'ABT');
		const interlinearAvailable = hasPrimary && hasABT;

		// Update interlinear button text
		this.updateInterlinearButtonText();

		// Show/hide interlinear button based on availability
		const interlinearButton = document.getElementById('versionInterlinearButton');
		if (interlinearButton) {
			if (interlinearAvailable) {
				interlinearButton.classList.remove(CLASS.HIDDEN);
			} else {
				interlinearButton.classList.add(CLASS.HIDDEN);
			}
		}

		// Render version list
		const versionItems = versionList.map(item => ({
			selected: ((!this.configManager.getValue('interlinearMode') && item.abbreviation === this.navigationManager.getCurrentVersion()) ? CLASS.SELECTED : ''),
			abbreviation: item.abbreviation,
			languageCode: item.languageCode.toUpperCase(),
			name: item.name,
			hidden: (item.hasLocalCopy ? '' : CLASS.HIDDEN)  // Show LOCAL badge if DB exists
		}));

		Template.render('versionTemplate', 'versionList', versionItems);

		this.modalManager.show(MODAL.VERSION);
	}

	async selectVersion(element) {
		const versionAbbr = element.getAttribute('data-abbreviation');
		if (versionAbbr === this.navigationManager.getCurrentVersion() && !this.configManager.getValue('interlinearMode')) {
			closeModal(MODAL.VERSION);
			return;
		}

		// Disable interlinear mode when switching versions
		if (this.configManager.getValue('interlinearMode')) {
			this.disableInterlinear();
		}

		const version = this.versionManager.getVersion(versionAbbr);
		if (!version) {
			console.error('Version not found:', versionAbbr);
			return;
		}

		closeModal(MODAL.VERSION);

		const currentBook = this.versionManager.findBookById(this.navigationManager.getCurrentBook());
		const result = await this.versionManager.switchVersionSafely(
			version,
			this.navigationManager.getCurrentBook(),
			this.navigationManager.getCurrentChapter(),
			currentBook ? currentBook.name : null
		);

		if (result.success) {
			this.navigationManager.setPosition(result.bookId, result.chapter);
			this.navigationManager.setCurrentVersion(version.abbreviation);
			this.navigationManager.saveSettings();

			if (result.notification) {
				this.navigationManager.showNotification(result.notification);
			}

			this.controller.onUpdateDisplay();
			this.updateInterlinearButtonText();
			await this.controller.onAnimateOut();
			await this.controller.onLoadChapterContent(version);
			this.controller.onAnimateIn();
		} else {
			this.modalManager.showError(
				'Failed to load ' + version.name + ': ' + result.error + '<br><br>Reverting to KJV.',
				async () => {
					this.navigationManager.setCurrentVersion('KJV');
					this.navigationManager.saveSettings();
					this.controller.onUpdateDisplay();
					await this.controller.onLoadCurrentChapter();
				}
			);
		}
	}

	disableInterlinear() {
		this.configManager.setValue('interlinearMode', false);
		delete this.interlinearPrimaryVersion;
		this.updateInterlinearMenuText();
	}

	async toggleInterlinearMode() {
		const currentValue = this.configManager.getValue('interlinearMode');

		if (!currentValue) {
			// Enabling interlinear - check if both versions exist in config
			const currentVersion = this.navigationManager.getCurrentVersion();
			const primaryVersionAbbr = (isCompleteVersion(currentVersion) && currentVersion !== 'ABT')
				? currentVersion
				: this.configManager.getValue('interlinearPrimaryVersion') || APP.INTERLINEAR_FALLBACK_PRIMARY;
			const versionA = this.versionManager.getVersion(primaryVersionAbbr);
			const versionB = this.versionManager.getVersion('ABT');

			if (!versionB) {
				this.modalManager.showError('Interlinear mode requires ABT to be configured.');
				return;
			}

			if (!versionA) {
				// Fall back to ESV if configured version not found
				console.warn(`Configured version ${primaryVersionAbbr} not found, falling back to ${APP.INTERLINEAR_FALLBACK_PRIMARY}`);
				this.configManager.setValue('interlinearPrimaryVersion', APP.INTERLINEAR_FALLBACK_PRIMARY);
				const fallbackVersion = this.versionManager.getVersion(APP.INTERLINEAR_FALLBACK_PRIMARY);

				if (!fallbackVersion) {
					this.modalManager.showError(`Interlinear mode requires ${APP.INTERLINEAR_FALLBACK_PRIMARY} or another configured version.`);
					return;
				}
			}

			// Check if at least one source is available for each
			try {
				const versionToCheck = versionA || this.versionManager.getVersion(APP.INTERLINEAR_FALLBACK_PRIMARY);
				await this.versionManager.resolveVersionSource(versionToCheck);
				await this.versionManager.resolveVersionSource(versionB);
			} catch (error) {
				this.modalManager.showError('Error: One or both versions are not available.<br><br>' + error.message);
				return;
			}
			this.interlinearPrimaryVersion = primaryVersionAbbr;
		}

		this.configManager.setValue('interlinearMode', !currentValue);
		this.updateInterlinearMenuText();
		closeModal(MODAL.VERSION);

		// Reload chapter and update display
		this.controller.onUpdateDisplay();
		await this.controller.onLoadCurrentChapter();
	}

	updateInterlinearMenuText() {
		const isEnabled = this.configManager.getValue('interlinearMode');
		const menuText = document.getElementById('interlinearMenuText');
		if (menuText) {
			menuText.textContent = isEnabled ? 'Disable Interlinear View' : 'Enable Interlinear View';
		}
	} 

	updateInterlinearButtonText() {
		const interlinearText = document.getElementById('interlinearVersionText');
		if (!interlinearText) return;

		const currentVersion = this.navigationManager.getCurrentVersion();
		const primaryVersionAbbr = (isCompleteVersion(currentVersion) && currentVersion !== 'ABT')
			? currentVersion
			: this.configManager.getValue('interlinearPrimaryVersion') || APP.INTERLINEAR_FALLBACK_PRIMARY;

		interlinearText.textContent = `Compare ${primaryVersionAbbr} with ABT`;
	}

	async getAvailableVersions() {
		const dbVersions = await this.versionManager.getAvailableDBVersions();
		const enabledVersions = this.configManager.getEnabledVersions();

		return VERSION_CONFIG.map(version => {
			// For new format with sources object
			if (version.sources) {
				const hasDB = version.sources.db && dbVersions.includes(version.abbreviation);
				const hasAPI = !!version.sources.api;

				if (hasDB || hasAPI) {
					return {
						...version,
						hasLocalCopy: hasDB
					};
				}
				return null;
			}

			// Legacy format compatibility
			if (version.source === 'api') {
				return { ...version, hasLocalCopy: false };
			}
			if (version.source === 'db') {
				return dbVersions.includes(version.abbreviation) ? { ...version, hasLocalCopy: true } : null;
			}
			return version;
		})
		.filter(v => v !== null)
		.filter(v => enabledVersions.includes(v.abbreviation));
	}
}