'use strict';

class BackupManager {
	constructor(storageManager, notesStore, readingPlanStore, dailyReadingManager, configManager, navigationManager) {
		this.storageManager = storageManager;
		this.notesStore = notesStore;
		this.readingPlanStore = readingPlanStore;
		this.dailyReadingManager = dailyReadingManager;
		this.configManager = configManager;
		this.navigationManager = navigationManager;
	}

	async exportBackup() {
		try {
			loading('Creating backup...');

			// Build compact reading plan progress
			const progressData = this.buildCompactProgress();

			// Get app version
			const appVersion = await new Promise((resolve) => {
				if (window.cordova && cordova.getAppVersion) {
					cordova.getAppVersion.getVersionNumber(resolve);
				} else {
					resolve('unknown');
				}
			});

			// Assemble backup object
			const settings = this.storageManager.loadAppSettings();
			const backup = {
				version: '1.0',
				appVersion: appVersion,
				exportDate: new Date().toISOString(),
				navigation: {
					book: settings.currentBook,
					bookName: settings.lastBookName,
					chapter: settings.currentChapter,
					version: settings.currentVersion
				},
				bookmark: this.storageManager.get(this.storageManager.keys.BOOKMARK),
				notes: this.notesStore.getNotes(),
				config: this.configManager.values,
				readingPlan: progressData
			};

			const json = JSON.stringify(backup, null, 2);
			const dateStr = new Date().toISOString().split('T')[0];
			const fileName = `mybibleapp_backup_${dateStr}.json`;

			closeLoading();

			// Try Web Share API first, fall back to direct file write
			if (navigator.share && navigator.canShare) {
				const file = new File([json], fileName, { type: 'application/json' });
				if (navigator.canShare({ files: [file] })) {
					await navigator.share({
						title: 'My Bible App Backup',
						files: [file]
					});
					return;
				}
			}

			// Fallback: write to Downloads folder (Android) or Documents (iOS)
			await this.writeBackupFile(json, fileName);

		} catch (error) {
			if (error.name !== 'AbortError') {
				openToast('Export failed: ' + error.message);
				console.error('Backup export error:', error);
			}
			closeLoading();
		}
	}

	async writeBackupFile(json, fileName) {
		return new Promise((resolve, reject) => {
			const targetDir = (window.cordova)
				? (cordova.file.externalRootDirectory
					? cordova.file.externalRootDirectory + 'Download/'
					: cordova.file.documentsDirectory)
				: null;

			if (!targetDir) {
				reject(new Error('File system not available'));
				return;
			}

			window.resolveLocalFileSystemURL(targetDir, (dirEntry) => {
				dirEntry.getFile(fileName, { create: true, exclusive: false }, (fileEntry) => {
					fileEntry.createWriter((writer) => {
						writer.onwriteend = () => {
							openToast(`Backup saved: ${fileName}`);
							resolve();
						};
						writer.onerror = (e) => reject(new Error(e.toString()));
						writer.write(new Blob([json], { type: 'application/json' }));
					}, reject);
				}, reject);
			}, (error) => {
				reject(new Error('Could not access download folder: ' + error.code));
			});
		});
	}

	importBackupFile() {
		const input = document.getElementById('backupFileInput');
		input.value = '';  // Reset so same file can be re-selected
		input.click();
	}

	onBackupFileSelected(input) {
		const file = input.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const backup = JSON.parse(e.target.result);
				this.validateAndImportBackup(backup);
			} catch (error) {
				openToast('Invalid backup file: could not parse JSON.');
				console.error('Backup parse error:', error);
			}
		};
		reader.readAsText(file);
	}

	validateAndImportBackup(backup) {
		// Basic structure validation
		if (!backup.version || !backup.exportDate) {
			openToast('Invalid backup file: missing required fields.');
			return;
		}

		const dateStr = new Date(backup.exportDate).toLocaleDateString();
		const confirmed = confirm(
			`Import backup from ${dateStr}?\n\n` +
			`This will replace ALL current settings, notes, bookmark, and reading plan progress.\n\n` +
			`The app will reload after import. Continue?`
		);

		if (!confirmed) return;

		this.applyBackup(backup);
	}

	applyBackup(backup) {
		try {
			loading('Restoring backup...');

			// Navigation state
			if (backup.navigation) {
				const nav = backup.navigation;
				this.storageManager.saveAppSettings(
					nav.book || APP.DEFAULT_BOOK,
					nav.chapter || APP.DEFAULT_CHAPTER,
					nav.version || APP.DEFAULT_VERSION,
					nav.bookName || null
				);
			}

			// Bookmark
			if (backup.bookmark) {
				this.storageManager.set(this.storageManager.keys.BOOKMARK, backup.bookmark);
			} else {
				this.storageManager.clearBookmark();
			}

			// Notes
			if (backup.notes && typeof backup.notes === 'object') {
				this.notesStore.setAllNotes(backup.notes);
			} else {
				this.notesStore.clearAllNotes();
			}

			// Config
			if (backup.config && typeof backup.config === 'object') {
				this.storageManager.set('bible_app_config', JSON.stringify(backup.config));
			}

			// Reading plan progress
			if (backup.readingPlan) {
				this.restoreCompactProgress(backup.readingPlan);
			} else {
				this.readingPlanStore.clearDailyReadingProgress();
			}

			// Reload app to apply all settings
			location.reload();

		} catch (error) {
			closeLoading();
			openToast('Restore failed: ' + error.message);
			console.error('Backup restore error:', error);
		}
	}

	// Build compact progress: only store days with any activity
	// true = all readings complete, [0,2] = indices of completed readings, absent = unstarted
	buildCompactProgress() {
		const manager = this.dailyReadingManager;
		if (!manager || !manager.completionState || manager.completionState.length === 0) {
			return null;
		}

		const progress = {};
		manager.completionState.forEach((dayCompletions, index) => {
			const dayNum = index + 1;
			const completedIndices = dayCompletions
				.map((done, i) => done ? i : -1)
				.filter(i => i !== -1);

			if (completedIndices.length === 0) return; // Unstarted - omit

			if (completedIndices.length === dayCompletions.length) {
				progress[dayNum] = true; // Fully complete
			} else {
				progress[dayNum] = completedIndices; // Partial
			}
		});

		return {
			year: manager.readingModeYear,
			progress: progress
		};
	}

	// Restore compact progress back to full completionState array
	restoreCompactProgress(planData) {
		const manager = this.dailyReadingManager;
		if (!manager || !manager.readingPlan || manager.readingPlan.length === 0) {
			// Plan not loaded yet — store raw and let initialize() handle it
			// We reconstruct a full completionState on next load instead
			const raw = this.expandCompactProgress(planData);
			if (raw) {
				this.readingPlanStore.setDailyReadingProgress(planData.year, raw);
			}
			return;
		}

		const expanded = this.expandCompactProgress(planData, manager.readingPlan);
		if (expanded) {
			this.readingPlanStore.setDailyReadingProgress(planData.year, expanded);
		}
	}

	expandCompactProgress(planData, readingPlan = null) {
		if (!planData || !planData.progress) return null;

		const year = planData.year || new Date().getFullYear();
		const progress = planData.progress;

		// If we have the reading plan, build a properly sized array
		if (readingPlan && readingPlan.length > 0) {
			const completions = readingPlan.map((dayReadings, index) => {
				const dayNum = String(index + 1);
				const entry = progress[dayNum];

				if (!entry) {
					return new Array(dayReadings.length).fill(false);
				}
				if (entry === true) {
					return new Array(dayReadings.length).fill(true);
				}
				// Partial: entry is array of completed indices
				const dayCompletions = new Array(dayReadings.length).fill(false);
				entry.forEach(i => {
					if (i < dayReadings.length) dayCompletions[i] = true;
				});
				return dayCompletions;
			});
			return completions;
		}

		// No reading plan available — build a best-effort array from the progress keys
		const maxDay = Math.max(...Object.keys(progress).map(Number), 365);
		const completions = [];
		for (let i = 0; i < maxDay; i++) {
			const dayNum = String(i + 1);
			const entry = progress[dayNum];
			if (!entry) {
				completions.push([false]);
			} else if (entry === true) {
				completions.push([true]);
			} else {
				const max = Math.max(...entry) + 1;
				const day = new Array(max).fill(false);
				entry.forEach(i => { day[i] = true; });
				completions.push(day);
			}
		}
		return completions;
	}
}