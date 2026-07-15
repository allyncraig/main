'use strict';

function isCompleteVersion(versionAbbr) {
	// List of known incomplete versions
	const otOnly = ['WLC', 'LXX']; // Hebrew OT, Greek OT
	const ntOnly = ['SBL', 'NTGT', 'TR']; // Greek NT versions
	
	return !otOnly.includes(versionAbbr) && !ntOnly.includes(versionAbbr);
}

// Define configuration
function buildConfigDefinition(versionConfig) {
	return [
		{
			key: 'interlinearPrimaryVersion',
			label: 'Interlinear Default Primary Version:',
			type: 'select',
			default_value: APP.INTERLINEAR_FALLBACK_PRIMARY,
			values: VERSION_CONFIG
				.filter(v => v.abbreviation !== 'ABT' && isCompleteVersion(v.abbreviation))
				.map(v => v.abbreviation),
			display_values: VERSION_CONFIG
				.filter(v => v.abbreviation !== 'ABT' && isCompleteVersion(v.abbreviation))
				.map(v => `${v.abbreviation} - ${v.name}`),
			help: 'Select the default Bible version to display alongside ABT in interlinear mode in case the currently viewed version cannot be used.',
			onChange: (value) => {
				// If interlinear mode is active, reload to show new version
				if (app.configManager.getValue('interlinearMode')) {
					updateDisplay();
					this.controller.onLoadCurrentChapter();
				}
			}
		},
		{
			key: 'darkMode',
			label: 'Display Mode:',
			type: 'toggle',
			default_value: false,
			text: 'Enable Dark Mode',
			help: 'Switch between light and dark color themes.',
			onChange: (value) => {
				// Apply dark mode immediately when toggled
				document.body.style.colorScheme = (value) ? CLASS.DARK : CLASS.LIGHT;
			}
		},
		{
			key: 'fontStyle',
			label: 'Font Style:',
			type: 'radio',
			default_value: 'serif',
			values: ['serif', 'sans-serif'],
			display_values: ['Serif Fonts', 'Sans-Serif Fonts'],
			help: 'Choose between serif and sans-serif fonts for Bible text.',
			onChange: (value) => {
				// Apply font change immediately when selected
				const el = document.getElementById(UI.MAINCONTENT);
				el.style.fontFamily = (value === 'serif') ? APP.FONTS_SERIF : APP.FONTS_SANSSERIF;
			}
		},
		{
			key: 'fontSize',
			label: 'Text Size:',
			type: 'slider',
			default_value: 18,
			min: 12,
			max: 32,
			step: 2,
			help: 'Adjust the size of Bible text.',
			onChange: (value) => {
				// Apply font size immediately for live preview
				app.fontSize = parseInt(value);
				app.contentRenderer.setFontSize(app.fontSize);
				// Note: ConfigManager will handle saving to storage
			}
		},
	];
}
