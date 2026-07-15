'use strict';

class ReadingPlanModalManager extends Manager {
	constructor(dailyReadingManager, modalManager, readingPlanStore, readingModeManager, versionManager) {
		super();
		this.dailyReadingManager = dailyReadingManager;
		this.modalManager = modalManager;
		this.readingPlanStore = readingPlanStore;
		this.readingModeManager = readingModeManager;
		this.versionManager = versionManager;
	}

	getDayOfYear(date) {
		return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
	}

	async showReadingPlan() {
		closeModal(MODAL.MENU);

		// Check for year rollover FIRST
		const rolloverStats = this.dailyReadingManager.checkYearRollover();
		if (rolloverStats) {
			this.showYearRolloverMessage(rolloverStats);
		}

		let planData = this.readingPlanStore.getReadingPlan();
		if (!planData) {
			await this.controller.onLoadReadingPlan();
			planData = this.readingPlanStore.getReadingPlan();
			if (!planData) {
				openToast('Failed to load reading plan. Please try again later.');
				console.log('Failed to load plan data.');
				return;
			}

			// Update the manager's reading plan
			this.dailyReadingManager.readingPlan = planData;
		}

		// Ensure completion state is initialized now that we have the plan
		this.dailyReadingManager.ensureInitialized();

		const today = new Date();
		const dayOfYear = this.getDayOfYear(today);

		// Determine which day to display
		const displayDay = this.readingModeManager.isActive ? this.dailyReadingManager.readingModeDay : dayOfYear;
		const todaysReadings = planData[displayDay - 1];

		if (!todaysReadings) {
			openToast('No reading plan available for today.');
			return;
		}

		// Render day cards
		this.renderDayCards(displayDay, today);

		// Update header
		const dateStr = today.toLocaleDateString('en-US', { 
			weekday: 'long', 
			year: 'numeric', 
			month: 'long', 
			day: 'numeric' 
		});

		const totalDays = this.dailyReadingManager.getDayCount();
		document.getElementById('readingPlanDoY').innerText = displayDay;
		document.getElementById('readingPlanTotal').innerText = totalDays;
		document.getElementById('readingPlanDate').innerText = dateStr;

		// Prepare template data - always create 5 slots
		const readings = [];
		for (let i = 0; i < 5; i++) {
			if (i < todaysReadings.length) {
				// Real reading
				readings.push({
					reference: this.expandReference(todaysReadings[i]),
					day: displayDay,
					index: i,
					state: this.dailyReadingManager.isComplete(displayDay, i) ? '' : '-blank',
					hidden: ''
				});
			} else {
				// Empty slot
				readings.push({
					reference: '',
					day: displayDay,
					index: i,
					state: '-blank',
					hidden: 'hidden'
				});
			}
		}

		// Render using template
		Template.render('readingPlanTemplate', 'readingPlanList', readings);

		// Update progress display
		this.updateProgressDisplay();

		this.modalManager.show(MODAL.READINGPLAN);

		// Scroll to current day WITHOUT animation on first open
		requestAnimationFrame(() => {
			const cardsContainer = document.getElementById('dailyReadingCards');

			// Temporarily disable smooth scrolling
			const originalBehavior = cardsContainer.style.scrollBehavior;
			cardsContainer.style.scrollBehavior = 'auto';

			// Scroll to position
			this.scrollToCurrentDay(displayDay, true);

			// Restore smooth scrolling for future interactions
			setTimeout(() => {
				cardsContainer.style.scrollBehavior = originalBehavior;
			}, 50);
		});
	}

	// Render day cards dynamically
	renderDayCards(selectedDay, todayDate) {
		const cardsContainer = document.getElementById('dailyReadingCards');
		cardsContainer.innerHTML = '';

		const totalDays = this.dailyReadingManager.getDayCount();
		const todayDayNum = this.getDayOfYear(todayDate);
		const year = this.dailyReadingManager.readingModeYear || new Date().getFullYear();
		const isCurrentYear = year === new Date().getFullYear();

		// Build data array for all days
		const cardData = [];
		for (let day = 1; day <= totalDays; day++) {
			cardData.push({
				day: day,
				date: this.getDayDate(day, year)
			});
		}

		Template.render('dayCardTemplate', 'dailyReadingCards', cardData, false);

		// Apply conditional classes and checkmarks post-render
		cardsContainer.querySelectorAll('.day-card').forEach(card => {
			const day = parseInt(card.dataset.day);

			if (day === selectedDay) {
				card.classList.add('selected');
			}
			if (day === todayDayNum && isCurrentYear) {
				card.classList.add('today');
			}
			if (this.dailyReadingManager.isDayComplete(day)) {
				const checkbox = document.createElement('div');
				checkbox.className = 'day-checkbox';
				checkbox.innerHTML = '✓';
				card.appendChild(checkbox);
			}
		});
	}

	// Handle day card selection
	selectDailyDay(day) {
		const planData = this.readingPlanStore.getReadingPlan();
		if (!planData || !planData[day - 1]) {
			openToast('No readings found for this day.');
			return;
		}

		const todaysReadings = planData[day - 1];
		const today = new Date();

		// Update header
		const dateStr = this.getDayDate(day, this.dailyReadingManager.readingModeYear || today.getFullYear());
		const totalDays = this.dailyReadingManager.getDayCount();

		document.getElementById('readingPlanDoY').innerText = day;
		document.getElementById('readingPlanTotal').innerText = totalDays;
		document.getElementById('readingPlanDate').innerText = dateStr;

		// Update readings list - always create 5 slots
		const readings = [];
		for (let i = 0; i < 5; i++) {
			if (i < todaysReadings.length) {
				// Real reading
				readings.push({
					reference: this.expandReference(todaysReadings[i]),
					day: day,
					index: i,
					state: this.dailyReadingManager.isComplete(day, i) ? '' : '-blank',
					hidden: ''
				});
			} else {
				// Empty slot
				readings.push({
					reference: '&nbsp;',
					day: day,
					index: i,
					state: '-blank',
					hidden: 'hidden'
				});
			}
		}

		Template.render('readingPlanTemplate', 'readingPlanList', readings);

		// Update card selection visually
		document.querySelectorAll('.day-card').forEach(card => {
			card.classList.remove('selected');
		});

		const selectedCard = document.querySelector(`.day-card[data-day="${day}"]`);
		if (selectedCard) {
			selectedCard.classList.add('selected');
			this.scrollToCurrentDay(day, false);
		}
	}

	// Scroll to selected/today's card
	scrollToCurrentDay(dayNum, immediate = false) {
		const cardsContainer = document.getElementById('dailyReadingCards');
		const selectedCard = cardsContainer.querySelector(`.day-card[data-day="${dayNum}"]`);

		if (selectedCard) {
			// Calculate scroll position to center the card
			const containerWidth = cardsContainer.offsetWidth;
			const cardLeft = selectedCard.offsetLeft;
			const cardWidth = selectedCard.offsetWidth;

			const scrollPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2);

			if (immediate) {
				// Instant scroll (no animation)
				cardsContainer.scrollLeft = scrollPosition;
			} else {
				// Smooth scroll
				cardsContainer.scrollTo({
					left: scrollPosition,
					behavior: 'smooth'
				});
			}
		}
	}

	// Update progress display
	updateProgressDisplay() {
		const progress = this.dailyReadingManager.getProgress();
		const totalDays = this.dailyReadingManager.getDayCount();

		document.getElementById('progressCount').textContent = `${progress.completed}/${totalDays}`;
		document.getElementById('progressPercent').textContent = `${progress.percentage}%`;

		const progressBar = document.getElementById('progressBar');
		progressBar.style.width = `${progress.percentage}%`;
	}

	// Convert day number (1-366) to date string (e.g., "Jan 15")
	getDayDate(dayNum, year) {
		const date = new Date(year, 0); // January 1st
		date.setDate(dayNum);

		const month = date.toLocaleDateString('en-US', { month: 'short' });
		const day = date.getDate();

		return `${month} ${day}`;
	}

	toggleReadingComplete(el) {
		const state = el.getAttribute('data-state');
		const dayNum = parseInt(el.dataset.day);
		const readingIdx = parseInt(el.dataset.index);
		const newState = (state === '') ? '-blank' : '';
		el.dataset.state = newState;
		el.classList.remove(`ion-android-checkbox-outline${state}`);
		el.classList.add(`ion-android-checkbox-outline${newState}`);

		const isComplete = (newState === '') ? true : false;

		this.dailyReadingManager.markComplete(dayNum, readingIdx, isComplete);

		// Update progress display
		this.updateProgressDisplay();

		// Update day card checkmark
		const dayCard = document.querySelector(`.day-card[data-day="${dayNum}"]`);
		if (dayCard) {
			const existingCheckbox = dayCard.querySelector('.day-checkbox');

			if (this.dailyReadingManager.isDayComplete(dayNum)) {
				// Add checkmark if not present
				if (!existingCheckbox) {
					const checkbox = document.createElement('div');
					checkbox.className = 'day-checkbox';
					checkbox.innerHTML = '✓';
					dayCard.appendChild(checkbox);
				}
			} else {
				// Remove checkmark if present
				if (existingCheckbox) {
					existingCheckbox.remove();
				}
			}
		}

		// console.log('Toggled reading:' + JSON.stringify({ day: dayNum, index: readingIdx, complete: isComplete }));

		// Check if day is now complete
		if (isComplete && this.dailyReadingManager.isDayComplete(dayNum)) {
			openToast(`Day ${dayNum} Daily Reading Complete!`);
		}
	}

	expandReference(ref) {
		const itemsArray = ref.split(' ');
		const book = this.versionManager.findBookByName(itemsArray[0]);
		let returnValue = ref;
		if (book) {
			returnValue = book.name + ' ' + itemsArray[1];
		}
		return returnValue;
	}

	showYearRolloverMessage(stats) {
		document.getElementById('aboutTitle').textContent = 'Year Complete!';
		Template.render('yearRolloverTemplate', 'aboutMessage', {
			completed: stats.completed,
			total: stats.total,
			percentage: stats.percentage,
			year: stats.year
		});
		app.modalManager.show(MODAL.ABOUT);
	}
}
