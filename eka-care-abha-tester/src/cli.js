const readline = require('readline');
const EkaCareClient = require('./eka_client');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  const client = new EkaCareClient();
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        EKA CARE ABDM / ABHA CLI INTERACTIVE TESTER         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`Connecting with Client ID: ${client.clientId}\n`);

  console.log('Authenticating with Eka Care API...');
  const authRes = await client.authenticate();
  if (!authRes.success) {
    console.log('\x1b[31m[!] Authentication failed:\x1b[0m', authRes.error);
    console.log('You can still inspect other features or check network credentials.');
  } else {
    console.log('\x1b[32m[✔] Successfully authenticated with Eka Care!\x1b[0m\n');
  }

  while (true) {
    console.log('\n-----------------------------------------');
    console.log('Choose an action to test:');
    console.log('1. Check ABHA Address availability (M1)');
    console.log('2. Request Aadhaar OTP for ABHA creation (M1)');
    console.log('3. Verify Aadhaar OTP & Complete Registration (M1)');
    console.log('4. Request Mobile OTP for ABHA creation (M1)');
    console.log('5. Discover Patient Care Context (M2)');
    console.log('6. Check Consent Request Status (M3)');
    console.log('7. Run Full Automated Test Suite');
    console.log('8. Exit');
    console.log('-----------------------------------------');

    const choice = (await ask('Select an option (1-8): ')).trim();

    if (choice === '1') {
      const address = await ask('Enter ABHA Address to check (e.g. john@abdm): ');
      const res = await client.checkAbhaAddressExists(address);
      console.log('Result:', JSON.stringify(res.data || res.error, null, 2));
    } else if (choice === '2') {
      const aadhaar = await ask('Enter 12-digit Aadhaar number: ');
      const res = await client.generateAadhaarOtp(aadhaar);
      console.log('Result:', JSON.stringify(res.data || res.error, null, 2));
    } else if (choice === '3') {
      const txnId = await ask('Enter Transaction ID (from OTP step): ');
      const otp = await ask('Enter OTP received: ');
      const mobile = await ask('Enter Mobile Number: ');
      const res = await client.verifyAadhaarOtp(txnId, otp, mobile);
      console.log('Result:', JSON.stringify(res.data || res.error, null, 2));
    } else if (choice === '4') {
      const mobile = await ask('Enter 10-digit Mobile number: ');
      const res = await client.generateMobileOtp(mobile);
      console.log('Result:', JSON.stringify(res.data || res.error, null, 2));
    } else if (choice === '5') {
      const mobile = await ask('Enter patient mobile to discover care contexts: ');
      const res = await client.discoverCareContext(mobile);
      console.log('Result:', JSON.stringify(res.data || res.error, null, 2));
    } else if (choice === '6') {
      const consentId = await ask('Enter Consent Request ID: ');
      const res = await client.checkConsentStatus(consentId);
      console.log('Result:', JSON.stringify(res.data || res.error, null, 2));
    } else if (choice === '7') {
      const { spawn } = require('child_process');
      await new Promise(resolve => {
        const proc = spawn('node', ['src/test_endpoints.js'], { stdio: 'inherit' });
        proc.on('close', resolve);
      });
    } else if (choice === '8') {
      console.log('Exiting Eka Care tester.');
      rl.close();
      break;
    } else {
      console.log('Invalid option, please choose between 1 and 8.');
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  rl.close();
});
