const fs = require('fs');

const TOKEN = 'EAAXvYwe64aEBSuHCp5CQRemVwct5OU5FEBcfyrvMphUZAVwXWWw0ORpkW1XZCYPNvBjsbpHiTPew6CfKMKybDZBUkr9E6jt30IYYS9lkUopXEZCBOGi0jJPTk9Wc2aKQW2K2ZBESmyvFBOVdtMFFh397X76XMxGf1kdOb3n0YCQVdF10BVhZAUCJfg2lqCkzzcukX8ydlJUNxreu141tXEG46mzUMkR5TbdRr3Xz23K9JebR1OZAYo2';
const PHONE_ID = '1309956365539677';
const phone = process.argv[2] || '918850934544';

const url = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;

const payload = {
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: phone,
  type: 'interactive',
  interactive: {
    type: 'cta_url',
    header: {
      type: 'text',
      text: '🏥 AAROGYA FLOW SERVICES'
    },
    body: {
      text: 'Welcome to Aarogya Flow!\n\n✨ Tap below to open our interactive service menu with live hospital search, token booking, live tracker, and records:'
    },
    footer: {
      text: 'Aarogya Flow • ABDM'
    },
    action: {
      name: 'cta_url',
      parameters: {
        display_text: '✨ Choose Service',
        url: `https://decency-immovable-synopsis.ngrok-free.dev/wa/services.html?phone=${phone}`
      }
    }
  }
};

async function run() {
  console.log(`Sending WhatsApp interactive message to ${phone}...`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${text}`);
}

run().catch(console.error);
