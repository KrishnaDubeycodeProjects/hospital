const axios = require('axios');
require('dotenv').config();

class EkaCareClient {
  constructor() {
    this.clientId = process.env.CLIENT_ID;
    this.clientSecret = process.env.CLIENT_SECRET;
    this.baseUrl = process.env.EKA_BASE_URL || 'https://api.eka.care';
    this.accessToken = null;
  }

  async authenticate() {
    try {
      const response = await axios.post(`${this.baseUrl}/connect-auth/v1/account/login`, {
        client_id: this.clientId,
        client_secret: this.clientSecret
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      const token = response.data.access_token || response.data.data?.access_token || response.data.token || response.data.data?.token;
      if (token) {
        this.accessToken = token;
        return { success: true, data: response.data, token: this.accessToken };
      }
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        error: error.response?.data || error.message
      };
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'client-id': this.clientId
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  async sendRequest(method, endpoint, body = null, params = null) {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: this.getHeaders(),
        data: body,
        params
      };
      const response = await axios(config);
      return { success: true, status: response.status, data: response.data };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status || 500,
        error: error.response?.data || error.message
      };
    }
  }

  // --- M1: Identity, KYC & ABHA Login / Registration ---
  async initKyc(type, value) {
    return this.sendRequest('POST', '/abdm/v1/profile/kyc/init', {
      type: type, // 'aadhaar' or 'abha-number'
      value: value
    });
  }

  async verifyLoginOtp(txnId, otp) {
    return this.sendRequest('POST', '/abdm/na/v1/profile/login/verify', {
      txn_id: txnId,
      otp: otp
    });
  }

  async checkAbhaAddress(abhaAddress) {
    return this.sendRequest('GET', '/abdm/v1/registration/check-address', null, { abha_address: abhaAddress });
  }

  // --- M2: Care Context Linking & Discovery ---
  async discoverPatient(mobile, patientName) {
    return this.sendRequest('POST', '/abdm/v1/hip/patient/discover', {
      mobile,
      name: patientName
    });
  }

  async linkCareContext(patientRef, careContexts) {
    return this.sendRequest('POST', '/abdm/v1/hip/care-context/link', {
      patientReference: patientRef,
      careContexts
    });
  }

  // --- M3: Consent Management & HIU Data ---
  async initConsent(consentPayload) {
    return this.sendRequest('POST', '/abdm/v1/hiu/consent/init', consentPayload);
  }

  async getConsentStatus(consentRequestId) {
    return this.sendRequest('GET', `/abdm/v1/hiu/consent/status/${consentRequestId}`);
  }
}

module.exports = EkaCareClient;
