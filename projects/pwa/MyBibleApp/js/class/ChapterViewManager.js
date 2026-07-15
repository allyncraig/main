'use strict';

class ChapterViewManager extends Manager {
	constructor(versionManager, navigationManager, contentRenderer, databaseManager, apiClient, configManager,
			modalManager, verseActionManager) {
		super();
		this.versionManager = versionManager;
		this.navigationManager = navigationManager;
		this.contentRenderer = contentRenderer;
		this.databaseManager = databaseManager;
		this.apiClient = apiClient;
		this.configManager = configManager;
		this.modalManager = modalManager;
		this.verseActionManager = verseActionManager;
	}

	async _fetchVerses(resolvedVersion, book, chapter) {
		if (resolvedVersion.source === 'db') {
			const rows = await this.databaseManager.loadChapter(
				book.id,
				chapter,
				resolvedVersion.tableVerses
			);
			return { data: rows, rawVerses: {}, source: 'db' };
		} else {
			const result = await this.apiClient.fetchChapter(
				resolvedVersion,
				book.apiId,
				chapter
			);
			const html = typeof result === 'string' ? result : result.html;
			const rawVerses = (typeof result === 'object' && result.rawVerses) ? result.rawVerses : {};
			return { data: html, rawVerses, source: 'api' };
		}
	}

	async loadCurrentChapter() {
		const version = this.versionManager.getVersion(this.navigationManager.getCurrentVersion());

		if (!version) {
			console.error('Version not found:', this.navigationManager.getCurrentVersion());
			return;
		}

		const books = this.versionManager.getBooks();
		const needsBookLoad = books.length === 0 || 
			(version.source === 'api' && (!books[0] || books[0].source !== 'api')) ||
			(version.source === 'db' && (!books[0] || books[0].source !== 'db'));

		if (needsBookLoad) {
			// console.log('Loading books for version:', version.abbreviation);
			await this.versionManager.loadBooksForVersion(version);
			this.updateDisplay();
		}

		await this.controller.onAnimateOut();
		await this.loadChapterContent(version);
		this.controller.onAnimateIn();
	}

	async loadChapterContent(version) {
		const currentBook = this.versionManager.findBookById(this.navigationManager.getCurrentBook());

		if (!currentBook) {
			console.error('Book not found with ID:', this.navigationManager.getCurrentBook());
			return;
		}

		const isInterlinear = this.configManager.getValue('interlinearMode');

		try {
			// Check if interlinear mode is enabled
			if (isInterlinear) {
				const primaryVersionAbbr = this.interlinearPrimaryVersion
					|| this.configManager.getValue('interlinearPrimaryVersion')
					|| APP.INTERLINEAR_FALLBACK_PRIMARY;
				const versionA = this.versionManager.getVersion(primaryVersionAbbr);
				const versionB = this.versionManager.getVersion('ABT');

				if (!versionA || !versionB) {
					console.warn('Interlinear mode enabled but versions not configured, falling back to single version');
					this.configManager.setValue('interlinearMode', false);
					this.controller.onUpdateInterlinearMenuText();
				} else {
					try {
						// Resolve both versions to get proper sources (DB or API)
						const resolvedVersionA = await this.versionManager.resolveVersionSource(versionA);
						const resolvedVersionB = await this.versionManager.resolveVersionSource(versionB);

						// Load books for version A if it's from API to get correct apiId
						let bookA = currentBook;
						if (resolvedVersionA.source === 'api') {
							const booksA = await this.apiClient.fetchBookList(resolvedVersionA);
							bookA = booksA.find(b => b.id === currentBook.id);
							if (!bookA) {
								throw new Error(`Book ID ${currentBook.id} not found in ${primaryVersionAbbr}`);
							}
						}

						// Load books for version B if it's from API to get correct apiId
						let bookB = currentBook;
						if (resolvedVersionB.source === 'api') {
							const booksB = await this.apiClient.fetchBookList(resolvedVersionB);
							bookB = booksB.find(b => b.id === currentBook.id);
							if (!bookB) {
								throw new Error(`Book ID ${currentBook.id} not found in ABT`);
							}
						}

						// Fetch verses from both versions (regardless of source)
						let versesA, versesB;

						// Fetch version A
						if (resolvedVersionA.source === 'db') {
							versesA = await this.databaseManager.loadChapter(
								currentBook.id,
								this.navigationManager.getCurrentChapter(),
								resolvedVersionA.tableVerses
							);
						} else {
							// Fetch from API and parse into verse format using correct apiId for this version
							const result = await this.apiClient.fetchChapter(
								resolvedVersionA,
								bookA.apiId,
								this.navigationManager.getCurrentChapter()
							);
							const contentA = typeof result === 'string' ? result : result.html;
							versesA = this.contentRenderer.parseAPIContent(contentA, currentBook.id, this.navigationManager.getCurrentChapter());
						}

						// Fetch version B
						if (resolvedVersionB.source === 'db') {
							versesB = await this.databaseManager.loadChapter(
								currentBook.id,
								this.navigationManager.getCurrentChapter(),
								resolvedVersionB.tableVerses
							);
						} else {
							// Fetch from API and parse into verse format using correct apiId for this version
							const result = await this.apiClient.fetchChapter(
								resolvedVersionB,
								bookB.apiId,
								this.navigationManager.getCurrentChapter()
							);
							const contentB = typeof result === 'string' ? result : result.html;
							versesB = this.contentRenderer.parseAPIContent(contentB, currentBook.id, this.navigationManager.getCurrentChapter());
						}

						// Render interlinear with unified verse format
						this.contentRenderer.renderChapterInterlinear(
							this.navigationManager.getCurrentChapter(),
							versesA,
							versesB,
							resolvedVersionA.source,
							resolvedVersionB.source,
							primaryVersionAbbr
						);
						return;
					} catch (error) {
						console.warn('Error rendering interlinear versions:', error);
						openToast('Error loading interlinear view: ' + error.message);
						this.configManager.setValue('interlinearMode', false);
						this.controller.onUpdateInterlinearMenuText();
					}
				}
			}

			// Resolve the version source to get proper properties
			const resolvedVersion = await this.versionManager.resolveVersionSource(version);

			const result = await this._fetchVerses(resolvedVersion, currentBook, this.navigationManager.getCurrentChapter());

			if (resolvedVersion.abbreviation === 'ABT') {
				if (result.source === 'db') {
					this.verseActionManager.setRawVerses({});
					const versesList = result.data.rows || result.data;
					const verseCount = result.data.rows ? result.data.rows.length : result.data.length;
					for (let i = 0; i < verseCount; i++) {
						const verse = versesList.item ? versesList.item(i) : versesList[i];
						this.verseActionManager.setRawVerse(verse.verse, verse.text);
					}
				} else {
					this.verseActionManager.setRawVerses(result.rawVerses);
				}
			} else {
				this.verseActionManager.setRawVerses({});
			}

			if (result.source === 'db') {
				this.contentRenderer.renderChapterFromDB(
					currentBook.name,
					this.navigationManager.getCurrentChapter(),
					result.data
				);
			} else {
				this.contentRenderer.renderChapterFromAPI(
					currentBook.name,
					this.navigationManager.getCurrentChapter(),
					result.data
				);
			}
		} catch (error) {
			// closeLoading();
			console.error('Error loading chapter:', error);
			this.contentRenderer.renderError('Error loading chapter: ' + error.message);
		}
	}

	async loadBooksAndChapter() {
		let version = this.versionManager.getVersion(this.navigationManager.getCurrentVersion());

		// If saved version is from DB but data doesn't exist, switch to KJV
		if (version && version.sources?.db && !version.sources?.api) {
			const hasData = await this.versionManager.hasVersionData(version.abbreviation);
			if (!hasData) {
				// console.log(`${version.abbreviation} data not available, switching to KJV`);
				this.navigationManager.setCurrentVersion('KJV');
				this.navigationManager.saveSettings();
				version = this.versionManager.getVersion('KJV');
			}
		}

		if (version) {
			try {
				await this.versionManager.loadBooksForVersion(version);
				await this.loadCurrentChapter();
			} catch (error) {
				console.error('Failed to load version:', error);
				this.contentRenderer.renderError('Failed to load Bible version. Please check your internet connection and try again.');
			}
		}
	}

	updateDisplay() {
		const chapterButton = document.getElementById(UI.CHAPTERSELECT);
		const versionButton = document.getElementById(UI.VERSIONBUTTON);

		const books = this.versionManager.getBooks();
		if (books.length === 0) {
			return;
		}

		const currentBook = this.versionManager.findBookById(this.navigationManager.getCurrentBook());

		// Use standard abbreviation from BOOK_DATA
		const bookDisplay = currentBook 
			? getBookAbbr(currentBook.id)
			: this.navigationManager.getCurrentBook();

		chapterButton.textContent = bookDisplay + ' ' + this.navigationManager.getCurrentChapter();

		// Update version button to show interlinear mode
		const isInterlinear = this.configManager.getValue('interlinearMode');
		if (isInterlinear) {
			const primaryVersion = this.interlinearPrimaryVersion
				|| this.configManager.getValue('interlinearPrimaryVersion')
				|| APP.INTERLINEAR_FALLBACK_PRIMARY;
			versionButton.textContent = `${primaryVersion}/ABT`;
		} else {
			versionButton.textContent = this.navigationManager.getCurrentVersion();
		}
	}

	async selectChapter(bookId, chapter) {
		closeModal(MODAL.CHAPTER);
		this.navigationManager.navigateToChapter(bookId, chapter);
		this.updateDisplay();
		await this.loadCurrentChapter();
	}

	showChapterSelector() {
		const books = this.versionManager.getBooks();

		if (books.length === 0) {
			return;
		}

		const content = document.getElementById('selectorContent');

		content.innerHTML = '';

		books.forEach(book => {
			const bookButton = document.createElement('button');
			bookButton.id = 'book-' + book.id;
			bookButton.textContent = book.name;

			bookButton.classList.add('book-panel');
			if (book.id === this.navigationManager.getCurrentBook()) {
				bookButton.classList.add('active');
			}

			const chapterContainer = document.createElement('div');
			chapterContainer.id = 'chapters-' + book.id;
			chapterContainer.classList.add('chapter-box');
			chapterContainer.dataset.isOpen = 'false';

			bookButton.onclick = () => {
				this.toggleChapterList(book, bookButton, chapterContainer);
			};

			const chapterGrid = document.createElement('div');
			chapterGrid.classList.add('chapter-grid');

			for (let i = 1; i <= book.chapters; i++) {
				const chapterButton = document.createElement('button');
				chapterButton.textContent = i;
				chapterButton.classList.add('book-chapter-button');
				if (book.id === this.navigationManager.getCurrentBook() && i === this.navigationManager.getCurrentChapter()) {
					chapterButton.classList.add('current');
				}

				chapterButton.onclick = (e) => {
					e.stopPropagation();
					this.selectChapter(book.id, i);
				};

				chapterGrid.appendChild(chapterButton);
			}

			chapterContainer.appendChild(chapterGrid);
			content.appendChild(bookButton);
			content.appendChild(chapterContainer);

			// Open current book's chapters
			if (book.id === this.navigationManager.getCurrentBook()) {
				chapterContainer.classList.add('open');
				chapterContainer.dataset.isOpen = 'true';

				setTimeout(() => {
					bookButton.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}, 100);
			}
		});

		this.modalManager.show(MODAL.CHAPTER);
	}

	toggleChapterList(book, bookButton, chapterContainer) {
		const isCurrentlyOpen = chapterContainer.dataset.isOpen === 'true';

		// Reset all book buttons to their default state
		const allBookButtons = document.querySelectorAll('[id^="book-"]');
		const currentBook = this.navigationManager.getCurrentBook();
		allBookButtons.forEach(btn => {
			const bookId = parseInt(btn.id.replace('book-', ''));
			if (bookId !== currentBook) {
				btn.classList.remove('active');
			}
		});

		// Close all other chapter containers
		const allChapterContainers = document.querySelectorAll('[id^="chapters-"]');
		allChapterContainers.forEach(container => {
			if (container !== chapterContainer) {
				container.classList.remove('open');
				container.dataset.isOpen = 'false';
			}
		});

		if (isCurrentlyOpen) {
			// Close this container
			chapterContainer.classList.remove('open');
			chapterContainer.dataset.isOpen = 'false';
		} else {
			// Open this container
			setTimeout(() => {
				chapterContainer.classList.add('open');
				chapterContainer.dataset.isOpen = 'true';

				// Highlight the opened book button if not current book
				if (book.id !== this.navigationManager.getCurrentBook()) {
					bookButton.classList.add('active');
				}

				// Wait for the open animation to start, then scroll
				setTimeout(() => {
					const selectorContent = document.getElementById('selectorContent');
					const containerRect = selectorContent.getBoundingClientRect();
					const buttonRect = bookButton.getBoundingClientRect();
					const scrollOffset = buttonRect.top - containerRect.top + selectorContent.scrollTop;

					selectorContent.scrollTo({
						top: scrollOffset,
						behavior: 'smooth'
					});
				}, 100);
			}, 50);
		}
	}

	async navigateChapter(direction) {
		if (direction === NAVIGATE_DIRECTION.PREVIOUS) {
			this.navigationManager.navigatePrevious();
		} else {
			this.navigationManager.navigateNext();
		}
		this.updateDisplay();
		await this.loadCurrentChapter();
	}
}