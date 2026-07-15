'use strict';

class ContactManager {
	constructor(modalManager) {
		this.modalManager = modalManager;
	}

	showContact() {
		this.modalManager.show(MODAL.CONTACT);
	}

	async sendContactMessage() {
		const contactType = document.querySelector('input[name="contactType"]:checked');
		const message = document.getElementById('contactComments').value;

		// Validation
		if (!contactType) {
			openToast('Please select a contact type');
			return;
		}

		if (!message || !message.trim()) {
			openToast('Please enter a message');
			return;
		}

		loading('Sending message...');

		try {
			// Submit to BOTH services in parallel
			await submitToProxy('contact', {
				contact_type: contactType.value,
				message: message.trim()
			});

			closeLoading();
			closeModal(MODAL.CONTACT);
			openToast('Message sent successfully! Thank you.');

			// Clear form
			document.getElementById('contactComments').value = '';
			document.querySelectorAll('input[name="contactType"]').forEach(radio => {
				radio.checked = radio.id === 'comment'; // Reset to default
			});
		} catch (error) {
			closeLoading();
			console.error('Contact form submission failed:', error);
			openToast(error.message);
		}
	}
}