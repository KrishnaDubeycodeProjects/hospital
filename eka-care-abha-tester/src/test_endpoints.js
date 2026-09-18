const EkaCareClient = require('./eka_client');

async function runTests() {
  console.log('====================================================');
  console.log('       EKA CARE ABDM / ABHA API TEST RUNNER         ');
  console.log('====================================================\n');

  const client = new EkaCareClient();
  console.log(`[*] Target Base URL : ${client.baseUrl}`);
  console.log(`[*] Client ID       : ${client.clientId}`);
  console.log(`[*] Client Secret   : ${client.clientSecret ? '******' + client.clientSecret.slice(-4) : 'NOT SET'}\n`);

  // Step 1: Authentication Test
  console.log('[1] Testing Authentication Endpoint (/connect-auth/v1/account/login)...');
  const authRes = await client.authenticate();
  if (authRes.success) {
    console.log('    \x1b[32m✔ SUCCESS:\x1b[0m Authentication verified!');
    console.log('    Token received:', authRes.token ? authRes.token.substring(0, 30) + '...' : JSON.stringify(authRes.data));
  } else {
    console.log('    \x1b[31m✖ FAILED / RESPONSE:\x1b[0m HTTP', authRes.status);
    console.log('    Details:', JSON.stringify(authRes.error, null, 2));
  }
  console.log('----------------------------------------------------');

  // Step 2: Milestone 1 - ABHA Identity & Registration
  console.log('\n[2] Testing M1 (ABHA Identity & KYC Initialization)...');
  console.log('  -> Testing KYC Init endpoint (/abdm/v1/profile/kyc/init)...');
  const kycRes = await client.initKyc('aadhaar', '999999999999');
  console.log(`     HTTP Status: ${kycRes.status}`);
  console.log('     Response:', JSON.stringify(kycRes.data || kycRes.error));

  console.log('  -> Testing ABHA Address check (/abdm/v1/registration/check-address)...');
  const addrRes = await client.checkAbhaAddress('testpatient@abdm');
  console.log(`     HTTP Status: ${addrRes.status}`);
  console.log('     Response:', JSON.stringify(addrRes.data || addrRes.error));
  console.log('----------------------------------------------------');

  // Step 3: Milestone 2 - Care Context Discovery & Linking
  console.log('\n[3] Testing M2 (Care Context Discovery)...');
  const discoverRes = await client.discoverPatient('9999999999', 'Test Patient');
  console.log(`     HTTP Status: ${discoverRes.status}`);
  console.log('     Response:', JSON.stringify(discoverRes.data || discoverRes.error));
  console.log('----------------------------------------------------');

  // Step 4: Milestone 3 - Consent Management
  console.log('\n[4] Testing M3 (Consent Request Status)...');
  const consentRes = await client.getConsentStatus('dummy-consent-id-1234');
  console.log(`     HTTP Status: ${consentRes.status}`);
  console.log('     Response:', JSON.stringify(consentRes.data || consentRes.error));

  console.log('\n====================================================');
  console.log('                 TEST SUMMARY REPORT                ');
  console.log('====================================================');
  console.log(`Auth Status : ${authRes.success ? '\x1b[32mAUTHENTICATED & READY\x1b[0m' : '\x1b[31mCHECK CREDENTIALS\x1b[0m'}`);
  console.log('The Eka Care client library and interactive tester are fully prepared.\n');
}

runTests();
