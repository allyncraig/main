'use strict';

async function submitToProxy(type, fields) {
	const response = await fetch(APP.PROXY_SUBMIT_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ type, fields })
	});

	if (!response.ok) {
		let message = 'Failed to send message. Please try again later.';
		try {
			const data = await response.json();
			if (data.error) message = data.error;
		} catch { /* use default message */ }
		throw new Error(message);
	}
}