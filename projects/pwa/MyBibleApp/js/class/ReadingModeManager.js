'use strict';

class ReadingModeManager extends Manager {
	constructor(dailyReadingManager, navigationManager, versionManager, contentRenderer, modalManager, configManager) {
		super();
		this.dailyReadingManager = dailyReadingManager;
		this.navigationManager = navigationManager;
		this.versionManager = versionManager;
		this.contentRenderer = contentRenderer;
		this.modalManager = modalManager;
		this.configManager = configManager;
		// Internal state
		this._currentReading = null;
		this._isActive = false;
		this._currentDay = null;
		this._scrollCheckEnabled = false;
		this._lastScrollCheck = 0;
		this._scrollContainer = null;
		this._scrollListener = null;
		this._scrollTimeout = null;
	}

	get isActive() {
		return this._isActive;
	}
	get currentDay() {
		return this._currentDay;
	}
	get currentReading() {
		return this._currentReading;
	}

	// Enter Daily Reading Mode
	_enterDailyReadingMode(day, readingIndex) {
		this.dailyReadingManager.enterDailyMode(day, readingIndex);
		this._isActive = true;
		this._currentDay = day;

		// Disable Go To Bookmark
		const bookmarkEl = document.getElementById('menuGotoBookmark');
		bookmarkEl.disabled = true;
		bookmarkEl.style.opacity = '0.5';

		this.updateHeaderForDailyMode(true);
		document.body.classList.add('reading-mode');

		// Show exit button
		const exitBtn = document.getElementById('exitDailyReadingButton');
		if (exitBtn) exitBtn.classList.remove('hidden');

		// console.log(`Entering daily reading mode: day(${day}) idx(${readingIndex})`);
	}

	// Exit Daily Reading Mode
	exitDailyReadingMode() {
		this.dailyReadingManager.exitDailyMode();
		this._isActive = false;
		this._currentDay = null;

		// Enable Go To Bookmark
		const bookmarkEl = document.getElementById('menuGotoBookmark');
		bookmarkEl.disabled = false;
		bookmarkEl.style.opacity = '1';

		// Disable scroll detection
		this.disableScrollDetection();

		// Remove dimming from all verses
		const dimmedVerses = document.querySelectorAll('.verse.dimmed');
		dimmedVerses.forEach(v => v.classList.remove('dimmed'));

		// Remove all "View Full Chapter" buttons
		const buttons = document.querySelectorAll('.view-full-chapter-btn');
		buttons.forEach(btn => btn.remove());

		// Clear reading context
		this._currentReading = null;

		this.updateHeaderForDailyMode(false);
		document.body.classList.remove('reading-mode');

		// Hide exit button
		const exitBtn = document.getElementById('exitDailyReadingButton');
		if (exitBtn) exitBtn.classList.add('hidden');

		closeModal(MODAL.READINGPLAN);
		// console.log('Exiting daily reading mode');
	}

	updateHeaderForDailyMode(isActive) {
		const backButton = document.getElementById('dailyReadingBackButton');
		const title = document.getElementById('headerTitle');

		if (isActive) {
			backButton.classList.remove('hidden');
			title.textContent = 'Daily Reading';
		} else {
			backButton.classList.add('hidden');
			title.textContent = 'My Bible App';
		}
	}

	async loadDailyReading() {
		const reading = this.dailyReadingManager.getCurrentReading();
		if (!reading) {
			console.error('No current reading found');
			return;
		}

		const parsed = this.parseReadingReference(reading.reference);
		if (!parsed) {
			console.error('Could not parse reading:', reading.reference);
			return;
		}

		// Check if book exists in current version, switch to KJV if needed
		const canProceed = await this.checkVersionForReading(parsed.book, parsed.chapter);
		if (!canProceed) {
			this.exitDailyReadingMode();
			return;
		}

		const books = this.versionManager.getBooks();
		const book = this.versionManager.findBookByName(parsed.book, books);

		if (!book) {
			openToast(`Book "${parsed.book}" not found`);
			this.exitDailyReadingMode();
			return;
		}

		// Validate chapter
		if (parsed.chapter > book.chapters) {
			openToast(`${book.name} only has ${book.chapters} chapters`);
			this.exitDailyReadingMode();
			return;
		}

		// Store reading context
		this._currentReading = {
			reference: reading.reference,
			day: reading.day,
			parsed: parsed,
			bookId: book.id
		};

		// Navigate to chapter
		this.navigationManager.setPosition(book.id, parsed.chapter);
		this.controller.onUpdateDisplay();
		await this.controller.onLoadCurrentChapter();

		// Enable scroll detection for auto-completion
		this.enableScrollDetection();

		// If verse range specified, scroll and dim
		if (parsed.verseStart !== null) {
			this.scrollToVerseAndDim(parsed.verseStart, parsed.verseEnd, false);
		}
	}

	parseReadingReference(ref) {
		// Parse formats like:
		// "Gen 15" → { book: "Gen", chapter: 15, verseStart: null, verseEnd: null }
		// "Gal 4:1-19" → { book: "Gal", chapter: 4, verseStart: 1, verseEnd: 19 }
		// "Mrk 1:21-45" → { book: "Mrk", chapter: 1, verseStart: 21, verseEnd: 45 }

		const match = ref.match(/^([A-Za-z0-9\s]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
		if (!match) {
			console.error('Could not parse reading reference: ' + ref);
			return null;
		}

		return {
			book: match[1].trim(),
			chapter: parseInt(match[2]),
			verseStart: match[3] ? parseInt(match[3]) : null,
			verseEnd: match[4] ? parseInt(match[4]) : null
		};
	}

	async handleDailyReadingNavigate(direction) {
		if (direction === NAVIGATE_DIRECTION.PREVIOUS) {
			if (this.dailyReadingManager.navigatePrevious()) {
				await this.controller.onAnimateOut();
				await this.loadDailyReading();
				this.controller.onUpdateDisplay();
				this.controller.onAnimateIn();
			} else {
				openToast('Already at first reading for this day');
			}
		} else {
			if (this.dailyReadingManager.navigateNext()) {
				await this.controller.onAnimateOut();
				await this.loadDailyReading();
				this.controller.onUpdateDisplay();
				this.controller.onAnimateIn();
			} else {
				openToast('Already at last reading for this day');
			}
		}
	}

	async checkVersionForReading(bookName, chapter) {
		const books = this.versionManager.getBooks();
		const book = this.versionManager.findBookByName(bookName, books);

		if (!book) {
			// Book doesn't exist in current version
			const currentVersion = this.navigationManager.getCurrentVersion();
			const bookId = getBookIndexByName(bookName);
			const testament = bookId ? getBookTestament(bookId) : null;

			let message = `${bookName} is not available in ${currentVersion}.`;

			if (testament === 'OT') {
				message += '\n\nThis is an Old Testament book. Switching to KJV.';
			} else if (testament === 'NT') {
				message += '\n\nThis is a New Testament book. Switching to KJV.';
			} else {
				message += '\n\nSwitching to KJV.';
			}

			if (!confirm(message)) {
				return false; // User cancelled
			}

			// Switch to KJV
			const kjvVersion = this.versionManager.getVersion('KJV');
			if (!kjvVersion) {
				openToast('KJV version not available');
				return false;
			}

			// Disable interlinear mode when switching
			if (this.configManager.getValue('interlinearMode')) {
				this.controller.onDisableInterlinear();
			}

			loading('Switching to KJV...');

			try {
				await this.versionManager.loadBooksForVersion(kjvVersion);
				this.navigationManager.setCurrentVersion('KJV');
				this.navigationManager.saveSettings();
				this.controller.onUpdateDisplay();
				closeLoading();
				return true; // Successfully switched
			} catch (error) {
				closeLoading();
				openToast('Error switching to KJV: ' + error.message);
				return false;
			}
		}

		return true; // Book exists in current version
	}

	scrollToVerseAndDim(verseStart, verseEnd, shouldHighlight = false) {
		const verses = document.querySelectorAll('.verse[data-verse]');
		let hasPartialChapter = false;
		const transitionPoints = [];
		let previousWasDimmed = null;

		verses.forEach((verseEl, index) => {
			const verseNum = parseInt(verseEl.getAttribute('data-verse'));

			if (verseEnd !== null) {
				const shouldDim = verseNum < verseStart || verseNum > verseEnd;

				if (shouldDim) {
					verseEl.classList.add('dimmed');
					hasPartialChapter = true;
				} else {
					verseEl.classList.remove('dimmed');
				}

				// Detect transitions
				if (previousWasDimmed !== null && previousWasDimmed !== shouldDim) {
					transitionPoints.push(index);
				}
				previousWasDimmed = shouldDim;
			}
		});

		// Add buttons if partial chapter
		if (hasPartialChapter) {
			// Remove any existing buttons first
			document.querySelectorAll('.view-full-chapter-btn').forEach(btn => btn.remove());

			// 1. Add button at the top (before first verse)
			if (verses.length > 0) {
				const topBtn = this._createViewFullChapterButton();
				verses[0].parentNode.insertBefore(topBtn, verses[0]);
			}

			// 2. Add buttons at transition points
			transitionPoints.forEach(index => {
				const transitionBtn = this._createViewFullChapterButton();
				verses[index].parentNode.insertBefore(transitionBtn, verses[index]);
			});

			// 3. Add button at the bottom (after last verse)
			if (verses.length > 0) {
				const bottomBtn = this._createViewFullChapterButton();
				const lastVerse = verses[verses.length - 1];
				lastVerse.parentNode.insertBefore(bottomBtn, lastVerse.nextSibling);
			}
		}

		// Scroll to starting verse (with optional highlighting)
		if (shouldHighlight) {
			this.contentRenderer.scrollToVerse(verseStart);
		} else {
			// Scroll without highlighting
			const verseElements = document.querySelectorAll('.verse-number');
			let targetVerse = null;

			for (let i = 0; i < verseElements.length; i++) {
				const verseNum = parseInt(verseElements[i].textContent.trim());
				if (verseNum === verseStart) {
					targetVerse = verseElements[i];
					break;
				}
			}

			if (targetVerse) {
				const verseParagraph = targetVerse.closest('.verse') || targetVerse.parentElement;
				verseParagraph.scrollIntoView({ behavior: 'instant', block: 'start' });
			} else {
				this.contentRenderer.scrollToTop();
			}
		}
	}

	viewFullChapter() {
		// Remove dimming from all verses
		const verses = document.querySelectorAll('.verse.dimmed');
		verses.forEach(v => v.classList.remove('dimmed'));

		// Remove ALL buttons (not just one)
		const buttons = document.querySelectorAll('.view-full-chapter-btn');
		buttons.forEach(btn => btn.remove());

		// Clear reading context
		this._currentReading = null;

		// Leave Daily Reading Mode
		this.exitDailyReadingMode();
	}

	_createViewFullChapterButton() {
		const btn = document.createElement('button');
		// view-full-chapter-btn this selector is required to make the buttons disappear when pressed.
		btn.classList.add('view-full-chapter-btn');
		btn.textContent = 'View Full Chapter';
		btn.onclick = () => this.viewFullChapter();
		return btn;
	}

	navigateToReading(reference, day, index) {
		const dayNum = parseInt(day);
		const readingIdx = parseInt(index);

		this._enterDailyReadingMode(dayNum, readingIdx);

		closeModal(MODAL.READINGPLAN);

		this.loadDailyReading();
	}

	enableScrollDetection() {
		if (this._scrollListener) {
			this.disableScrollDetection(); // Clean up old listener first
		}

		this._scrollCheckEnabled = false; // Disabled initially
		this._lastScrollCheck = 0;

		// Find the scrollable container - it's .content-area, not the content div
		const scrollContainer = this.contentRenderer.getScrollContainer();
		if (!scrollContainer) {
			console.error('Scroll container not found');
			return;
		}

		this._scrollContainer = scrollContainer;

		this._scrollListener = () => {
			// Only check if enabled and enough time has passed
			const now = Date.now();
			if (!this._scrollCheckEnabled || now - this._lastScrollCheck < 150) {
				return;
			}

			// Debounce scroll events
			clearTimeout(this._scrollTimeout);
			this._scrollTimeout = setTimeout(() => {
				this._checkScrollCompletion();
				this._lastScrollCheck = Date.now();
			}, 150);
		};

		this._scrollContainer.addEventListener('scroll', this._scrollListener);

		// Enable checking after initial load delay
		setTimeout(() => {
			this._scrollCheckEnabled = true;
			// console.log('Scroll detection enabled');
		}, 500);
	}

	disableScrollDetection() {
		if (this._scrollListener && this._scrollContainer) {
			this._scrollContainer.removeEventListener('scroll', this._scrollListener);
			this._scrollListener = null;
			this._scrollContainer = null;
		}
		this._scrollCheckEnabled = false;
		clearTimeout(this._scrollTimeout);
		// console.log('Scroll detection disabled');
	}

	_checkScrollCompletion() {
		// Only in daily reading mode
		if (!this.isActive) return;

		const element = this._scrollContainer;
		if (!element) return;

		const threshold = 50; // pixels from bottom

		// Check if we have dimmed verses (partial chapter reading)
		const dimmedVerses = document.querySelectorAll('.verse.dimmed');
		const hasDimmedVerses = dimmedVerses.length > 0;

		if (hasDimmedVerses) {
			// For partial readings, find the last non-dimmed verse
			const allVerses = Array.from(document.querySelectorAll('.verse'));
			const lastVisibleVerse = allVerses.reverse().find(v => !v.classList.contains('dimmed'));

			if (!lastVisibleVerse) return;

			// Check if last visible verse is in viewport or has been scrolled past
			const verseRect = lastVisibleVerse.getBoundingClientRect();
			const containerRect = element.getBoundingClientRect();

			// Check if the bottom of the last visible verse is at or above the bottom of the viewport
			const isLastVerseVisible = verseRect.bottom <= containerRect.bottom + threshold;

			if (isLastVerseVisible) {
				this._handleReadingComplete();
			}
		} else {
			// For full chapter readings, use the original logic
			const scrollPosition = element.scrollTop + element.clientHeight;
			const scrollHeight = element.scrollHeight;

			if (scrollHeight - scrollPosition <= threshold) {
				this._handleReadingComplete();
			}
		}
	}

	_handleReadingComplete() {
		const reading = this.dailyReadingManager.getCurrentReading();
		if (!reading) {
			return;
		}

		// Check if already complete
		if (this.dailyReadingManager.isComplete(reading.day, reading.index)) {
			return; // Already marked
		}

		// Mark as complete
		this.dailyReadingManager.markComplete(parseInt(reading.day), reading.index, true);

		// Update UI if modal is open
		if (this.modalManager.isVisible(MODAL.READINGPLAN)) {
			// Update checkbox in modal
			const checkbox = document.querySelector(
				`[data-day="${reading.day}"][data-index="${reading.index}"]`
			);
			if (checkbox) {
				checkbox.dataset.state = '';
				checkbox.classList.remove('ion-android-checkbox-outline-blank');
				checkbox.classList.add('ion-android-checkbox-outline');
			}

			// Update progress
			updateProgressDisplay();

			// Update day card checkmark
			const dayCard = document.querySelector(`.day-card[data-day="${reading.day}"]`);
			if (dayCard) {
				const existingCheckbox = dayCard.querySelector('.day-checkbox');

				if (this.dailyReadingManager.isDayComplete(reading.day)) {
					if (!existingCheckbox) {
						const checkbox = document.createElement('div');
						checkbox.className = 'day-checkbox';
						checkbox.innerHTML = '✓';
						dayCard.appendChild(checkbox);
					}
				}
			}
		}

		// Check if day is complete
		if (this.dailyReadingManager.isDayComplete(reading.day)) {
			// Disable scroll detection temporarily to prevent double-triggers
			this._scrollCheckEnabled = false;
			openToast(`Day ${reading.day} Daily Reading Complete!`);
			// Re-enable after dialog
			setTimeout(() => {
				this._scrollCheckEnabled = true;
			}, 1000);
		}
	}
}