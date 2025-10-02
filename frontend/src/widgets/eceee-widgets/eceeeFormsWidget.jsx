/**
 * ECEEE Forms Widget
 * 
 * ECEEE-specific implementation of the Forms widget.
 * Widget type: eceee_widgets.FormsWidget
 */

import React from 'react';
import FormsWidget from '../default-widgets/FormsWidget';

const eceeeFormsWidget = (props) => {
    // Use the default FormsWidget component but with eceee_widgets namespace
    return <FormsWidget {...props} />;
};

// Widget metadata
eceeeFormsWidget.displayName = 'ECEEE Forms';
eceeeFormsWidget.widgetType = 'eceee_widgets.FormsWidget';

eceeeFormsWidget.defaultConfig = {
    title: 'Contact Form',
    description: null,
    fields: [
        {
            name: 'name',
            label: 'Name',
            type: 'text',
            required: true,
            placeholder: 'Your name'
        },
        {
            name: 'email',
            label: 'Email',
            type: 'email',
            required: true,
            placeholder: 'your.email@example.com'
        },
        {
            name: 'message',
            label: 'Message',
            type: 'textarea',
            required: true,
            placeholder: 'Your message...'
        }
    ],
    submit_url: null,
    submit_method: 'POST',
    success_message: 'Thank you for your submission!',
    error_message: 'There was an error submitting the form. Please try again.',
    submit_button_text: 'Submit',
    reset_button: false,
    ajax_submit: true,
    redirect_url: null,
    email_notifications: false,
    notification_email: null,
    store_submissions: true,
    honeypot_protection: true,
    recaptcha_enabled: false,
    css_framework: 'default'
};

eceeeFormsWidget.metadata = {
    name: 'ECEEE Forms',
    description: 'ECEEE-specific form widget with schema-based field configuration',
    category: 'forms',
    icon: null,
    tags: ['form', 'contact', 'input', 'eceee'],
    menuItems: []
};

export default eceeeFormsWidget;

