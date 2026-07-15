'use strict';

class ReadingPlanStore {
	constructor() {
		this.READING_PLAN_KEY = 'readingPlan';
		this.PROGRESS_KEY = 'daily_reading_progress';
	}

	getReadingPlan() {
		try {
			const plan = localStorage.getItem(this.READING_PLAN_KEY);
			return plan ? JSON.parse(plan) : null;
		} catch (e) {
			console.error('ReadingPlanStore: Error parsing reading plan', e);
			return null;
		}
	}

	setReadingPlan(planData) {
		localStorage.setItem(this.READING_PLAN_KEY, JSON.stringify(planData));
	}

	clearReadingPlan() {
		localStorage.removeItem(this.READING_PLAN_KEY);
	}

	getDailyReadingProgress() {
		try {
			const data = localStorage.getItem(this.PROGRESS_KEY);
			return data ? JSON.parse(data) : null;
		} catch (e) {
			console.error('ReadingPlanStore: Error parsing reading progress', e);
			return null;
		}
	}

	setDailyReadingProgress(year, completions) {
		localStorage.setItem(this.PROGRESS_KEY, JSON.stringify({ year, completions }));
	}

	clearDailyReadingProgress() {
		localStorage.removeItem(this.PROGRESS_KEY);
	}
}