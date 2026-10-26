import React, { useState } from 'react';
import {
  Users,
  Baby,
  Syringe,
  HeartPulse,
  ShieldAlert,
  ArrowRight,
  CheckCircle,
  Clock,
  Sparkles,
  LayoutGrid,
  ListFilter,
  Send,
  Volume2,
  X,
  FileText,
  Search,
  Check,
  RefreshCw,
  Wifi,
  Phone,
  Building2,
  Calendar
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { syncApi } from '../../api/client';

// 24 village households data for Chandpur Village with real patient contact & ABHA numbers
const INITIAL_HOUSEHOLDS = [
  {
    "id": 1,
    "houseNo": 1,
    "familyName": "Satish Chandra",
    "primaryPhone": 9876500001,
    "membersCount": 4,
    "status": "7days",
    "lastVisited": "10 Oct 2026",
    "nextVisit": "गंभीर (Severe)",
    "pregnancy": true,
    "child": true,
    "ncd": false,
    "members": [
      {
        "name": "Satish Chandra",
        "age": 43,
        "gender": "पुरुष",
        "phone": 9876500001,
        "abhaId": "91-3026-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Rajna Devi",
        "age": 39,
        "gender": "महिला",
        "phone": 9876500001,
        "abhaId": "91-4703-3847-5501",
        "condition": "सामान्य",
        "isPregnant": true,
        "isHrp": true,
        "childVaccine": null
      },
      {
        "name": "Khushbu Kumari",
        "age": 13,
        "gender": "महिला",
        "phone": 9876500001,
        "abhaId": "91-2196-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Nilesh Kumar",
        "age": 1,
        "gender": "बालक",
        "phone": 9876500001,
        "abhaId": "91-5856-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      }
    ]
  },
  {
    "id": 2,
    "houseNo": 2,
    "familyName": "Priya Yadav",
    "primaryPhone": 9876500002,
    "membersCount": 5,
    "status": "15days",
    "lastVisited": "12 Oct 2026",
    "nextVisit": "मध्यम (Medium)",
    "pregnancy": true,
    "child": true,
    "ncd": false,
    "members": [
      {
        "name": "Priya Yadav",
        "age": 30,
        "gender": "महिला",
        "phone": 9876500002,
        "abhaId": "91-1824-3847-5501",
        "condition": "सामान्य",
        "isPregnant": true,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Mahendra Yadav",
        "age": 34,
        "gender": "पुरुष",
        "phone": 9876500002,
        "abhaId": "91-8418-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Aryan Yadav",
        "age": 3,
        "gender": "बालक",
        "phone": 9876500002,
        "abhaId": "91-3780-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      },
      {
        "name": "Ananya Yadav",
        "age": 6,
        "gender": "महिला",
        "phone": 9876500002,
        "abhaId": "91-9257-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Devki Yadav",
        "age": 58,
        "gender": "महिला",
        "phone": 9876500002,
        "abhaId": "91-9887-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 3,
    "houseNo": 3,
    "familyName": "Kailash Patil",
    "primaryPhone": 9876500003,
    "membersCount": 3,
    "status": "30days",
    "lastVisited": "15 Oct 2026",
    "nextVisit": "सामान्य (Normal)",
    "pregnancy": false,
    "child": false,
    "ncd": true,
    "members": [
      {
        "name": "Kailash Patil",
        "age": 48,
        "gender": "पुरुष",
        "phone": 9876500003,
        "abhaId": "91-2145-3847-5501",
        "condition": "उच्च रक्तचाप / दीर्घकालिक",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Sarita Patil",
        "age": 44,
        "gender": "महिला",
        "phone": 9876500003,
        "abhaId": "91-3657-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Rohan Patil",
        "age": 20,
        "gender": "पुरुष",
        "phone": 9876500003,
        "abhaId": "91-5492-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 4,
    "houseNo": 4,
    "familyName": "Ramesh Yadav",
    "primaryPhone": 9876500004,
    "membersCount": 6,
    "status": "visited",
    "lastVisited": "20 Oct 2026",
    "nextVisit": "भेंट पूर्ण (Visited)",
    "pregnancy": false,
    "child": true,
    "ncd": false,
    "members": [
      {
        "name": "Ramesh Yadav",
        "age": 35,
        "gender": "पुरुष",
        "phone": 9876500004,
        "abhaId": "91-4972-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Geeta Yadav",
        "age": 31,
        "gender": "महिला",
        "phone": 9876500004,
        "abhaId": "91-2865-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Bunty Yadav",
        "age": 4,
        "gender": "बालक",
        "phone": 9876500004,
        "abhaId": "91-6070-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      },
      {
        "name": "Pinki Yadav",
        "age": 7,
        "gender": "महिला",
        "phone": 9876500004,
        "abhaId": "91-7453-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Hariram Yadav",
        "age": 62,
        "gender": "पुरुष",
        "phone": 9876500004,
        "abhaId": "91-9484-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Sharda Yadav",
        "age": 58,
        "gender": "महिला",
        "phone": 9876500004,
        "abhaId": "91-6619-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 5,
    "houseNo": 5,
    "familyName": "Farooq Khan",
    "primaryPhone": 9876500005,
    "membersCount": 2,
    "status": "noData",
    "lastVisited": "05 Oct 2026",
    "nextVisit": "नई जानकारी (No data)",
    "pregnancy": false,
    "child": false,
    "ncd": false,
    "members": [
      {
        "name": "Farooq Khan",
        "age": 40,
        "gender": "पुरुष",
        "phone": 9876500005,
        "abhaId": "91-9430-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Shabana Khan",
        "age": 36,
        "gender": "महिला",
        "phone": 9876500005,
        "abhaId": "91-5777-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 6,
    "houseNo": 6,
    "familyName": "Shanti Devi",
    "primaryPhone": 9876500006,
    "membersCount": 4,
    "status": "7days",
    "lastVisited": "08 Oct 2026",
    "nextVisit": "गंभीर (Severe)",
    "pregnancy": false,
    "child": false,
    "ncd": true,
    "members": [
      {
        "name": "Shanti Devi",
        "age": 57,
        "gender": "महिला",
        "phone": 9876500006,
        "abhaId": "91-8677-3847-5501",
        "condition": "उच्च रक्तचाप / दीर्घकालिक",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Ramswaroop",
        "age": 60,
        "gender": "पुरुष",
        "phone": 9876500006,
        "abhaId": "91-3337-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Manoj Kumar",
        "age": 26,
        "gender": "पुरुष",
        "phone": 9876500006,
        "abhaId": "91-1567-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Pooja Kumari",
        "age": 23,
        "gender": "महिला",
        "phone": 9876500006,
        "abhaId": "91-1701-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 7,
    "houseNo": 7,
    "familyName": "Meena Kumari",
    "primaryPhone": 9876500007,
    "membersCount": 3,
    "status": "15days",
    "lastVisited": "14 Oct 2026",
    "nextVisit": "मध्यम (Medium)",
    "pregnancy": true,
    "child": false,
    "ncd": false,
    "members": [
      {
        "name": "Meena Kumari",
        "age": 29,
        "gender": "महिला",
        "phone": 9876500007,
        "abhaId": "91-2450-3847-5501",
        "condition": "सामान्य",
        "isPregnant": true,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Rakesh Kumar",
        "age": 32,
        "gender": "पुरुष",
        "phone": 9876500007,
        "abhaId": "91-1515-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Tanu Kumari",
        "age": 5,
        "gender": "बालिका",
        "phone": 9876500007,
        "abhaId": "91-2302-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      }
    ]
  },
  {
    "id": 8,
    "houseNo": 8,
    "familyName": "Vikram Joshi",
    "primaryPhone": 9876500008,
    "membersCount": 4,
    "status": "visited",
    "lastVisited": "21 Oct 2026",
    "nextVisit": "भेंट पूर्ण (Visited)",
    "pregnancy": false,
    "child": true,
    "ncd": false,
    "members": [
      {
        "name": "Vikram Joshi",
        "age": 42,
        "gender": "पुरुष",
        "phone": 9876500008,
        "abhaId": "91-9540-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Anuradha Joshi",
        "age": 38,
        "gender": "महिला",
        "phone": 9876500008,
        "abhaId": "91-4352-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Aditya Joshi",
        "age": 3,
        "gender": "बालक",
        "phone": 9876500008,
        "abhaId": "91-1616-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      },
      {
        "name": "Kavita Joshi",
        "age": 9,
        "gender": "महिला",
        "phone": 9876500008,
        "abhaId": "91-1397-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 9,
    "houseNo": 9,
    "familyName": "Sanjay Mishra",
    "primaryPhone": 9876500009,
    "membersCount": 5,
    "status": "30days",
    "lastVisited": "16 Oct 2026",
    "nextVisit": "सामान्य (Normal)",
    "pregnancy": false,
    "child": false,
    "ncd": true,
    "members": [
      {
        "name": "Sanjay Mishra",
        "age": 46,
        "gender": "पुरुष",
        "phone": 9876500009,
        "abhaId": "91-3638-3847-5501",
        "condition": "उच्च रक्तचाप / दीर्घकालिक",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Poonam Mishra",
        "age": 42,
        "gender": "महिला",
        "phone": 9876500009,
        "abhaId": "91-7924-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Alok Mishra",
        "age": 18,
        "gender": "पुरुष",
        "phone": 9876500009,
        "abhaId": "91-2802-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Shreya Mishra",
        "age": 15,
        "gender": "महिला",
        "phone": 9876500009,
        "abhaId": "91-2929-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Vidya Mishra",
        "age": 68,
        "gender": "महिला",
        "phone": 9876500009,
        "abhaId": "91-1283-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 10,
    "houseNo": 10,
    "familyName": "Gurpreet Singh",
    "primaryPhone": 9876500010,
    "membersCount": 4,
    "status": "noData",
    "lastVisited": "null",
    "nextVisit": "नई जानकारी (No data)",
    "pregnancy": false,
    "child": true,
    "ncd": false,
    "members": [
      {
        "name": "Gurpreet Singh",
        "age": 39,
        "gender": "पुरुष",
        "phone": 9876500010,
        "abhaId": "91-1382-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Simran Kaur",
        "age": 35,
        "gender": "महिला",
        "phone": 9876500010,
        "abhaId": "91-9948-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Jaspreet Singh",
        "age": 2,
        "gender": "बालक",
        "phone": 9876500010,
        "abhaId": "91-5413-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      },
      {
        "name": "Amrit Kaur",
        "age": 8,
        "gender": "महिला",
        "phone": 9876500010,
        "abhaId": "91-7472-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 11,
    "houseNo": 11,
    "familyName": "Anil Gupta",
    "primaryPhone": 9876500011,
    "membersCount": 3,
    "status": "visited",
    "lastVisited": "19 Oct 2026",
    "nextVisit": "भेंट पूर्ण (Visited)",
    "pregnancy": false,
    "child": false,
    "ncd": false,
    "members": [
      {
        "name": "Anil Gupta",
        "age": 34,
        "gender": "पुरुष",
        "phone": 9876500011,
        "abhaId": "91-4002-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Ritu Gupta",
        "age": 30,
        "gender": "महिला",
        "phone": 9876500011,
        "abhaId": "91-8438-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Mayank Gupta",
        "age": 7,
        "gender": "पुरुष",
        "phone": 9876500011,
        "abhaId": "91-9925-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 12,
    "houseNo": 12,
    "familyName": "Verma",
    "primaryPhone": 9876500012,
    "membersCount": 5,
    "status": "7days",
    "lastVisited": "12 Oct 2026",
    "nextVisit": "गंभीर (Severe)",
    "pregnancy": true,
    "child": true,
    "ncd": true,
    "members": [
      {
        "name": "Suman Verma",
        "age": 28,
        "gender": "महिला",
        "phone": 9876543211,
        "abhaId": "91-7589-3847-5501",
        "condition": "सामान्य",
        "isPregnant": true,
        "isHrp": true,
        "childVaccine": null
      },
      {
        "name": "Rajesh Verma",
        "age": 35,
        "gender": "पुरुष",
        "phone": 9876500012,
        "abhaId": "91-1083-3847-5501",
        "condition": "उच्च रक्तचाप / दीर्घकालिक",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Aarti Verma",
        "age": 16,
        "gender": "महिला",
        "phone": 9876500012,
        "abhaId": "91-7216-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Vivek Verma",
        "age": 10,
        "gender": "पुरुष",
        "phone": 9876500012,
        "abhaId": "91-2494-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Pooja Verma",
        "age": 1,
        "gender": "बालिका",
        "phone": 9876500012,
        "abhaId": "91-5562-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      }
    ]
  },
  {
    "id": 13,
    "houseNo": 13,
    "familyName": "Deepak Maurya",
    "primaryPhone": 9876500013,
    "membersCount": 3,
    "status": "noData",
    "lastVisited": "null",
    "nextVisit": "नई जानकारी (No data)",
    "pregnancy": false,
    "child": false,
    "ncd": false,
    "members": [
      {
        "name": "Deepak Maurya",
        "age": 41,
        "gender": "पुरुष",
        "phone": 9876500013,
        "abhaId": "91-2284-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Rekha Maurya",
        "age": 37,
        "gender": "महिला",
        "phone": 9876500013,
        "abhaId": "91-5581-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Akash Maurya",
        "age": 12,
        "gender": "पुरुष",
        "phone": 9876500013,
        "abhaId": "91-7195-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 14,
    "houseNo": 14,
    "familyName": "Naresh Patel",
    "primaryPhone": 9876500014,
    "membersCount": 4,
    "status": "15days",
    "lastVisited": "13 Oct 2026",
    "nextVisit": "मध्यम (Medium)",
    "pregnancy": false,
    "child": true,
    "ncd": false,
    "members": [
      {
        "name": "Naresh Patel",
        "age": 33,
        "gender": "पुरुष",
        "phone": 9876500014,
        "abhaId": "91-8706-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Kavita Patel",
        "age": 29,
        "gender": "महिला",
        "phone": 9876500014,
        "abhaId": "91-3861-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Aarav Patel",
        "age": 2,
        "gender": "बालक",
        "phone": 9876500014,
        "abhaId": "91-5729-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      },
      {
        "name": "Geeta Patel",
        "age": 58,
        "gender": "महिला",
        "phone": 9876500014,
        "abhaId": "91-7299-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 15,
    "houseNo": 15,
    "familyName": "Suresh Chauhan",
    "primaryPhone": 9876500015,
    "membersCount": 5,
    "status": "visited",
    "lastVisited": "22 Oct 2026",
    "nextVisit": "भेंट पूर्ण (Visited)",
    "pregnancy": false,
    "child": true,
    "ncd": false,
    "members": [
      {
        "name": "Suresh Chauhan",
        "age": 38,
        "gender": "पुरुष",
        "phone": 9876500015,
        "abhaId": "91-6985-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Rita Chauhan",
        "age": 34,
        "gender": "महिला",
        "phone": 9876500015,
        "abhaId": "91-8612-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Shivam Chauhan",
        "age": 2,
        "gender": "बालक",
        "phone": 9876500015,
        "abhaId": "91-2655-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      },
      {
        "name": "Neha Chauhan",
        "age": 8,
        "gender": "महिला",
        "phone": 9876500015,
        "abhaId": "91-5095-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Jagdish Chauhan",
        "age": 66,
        "gender": "पुरुष",
        "phone": 9876500015,
        "abhaId": "91-5056-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 16,
    "houseNo": 16,
    "familyName": "Harish Rawat",
    "primaryPhone": 9876500016,
    "membersCount": 4,
    "status": "30days",
    "lastVisited": "18 Oct 2026",
    "nextVisit": "सामान्य (Normal)",
    "pregnancy": false,
    "child": false,
    "ncd": true,
    "members": [
      {
        "name": "Harish Rawat",
        "age": 47,
        "gender": "पुरुष",
        "phone": 9876500016,
        "abhaId": "91-7561-3847-5501",
        "condition": "उच्च रक्तचाप / दीर्घकालिक",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Sushila Rawat",
        "age": 43,
        "gender": "महिला",
        "phone": 9876500016,
        "abhaId": "91-6428-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Pankaj Rawat",
        "age": 21,
        "gender": "पुरुष",
        "phone": 9876500016,
        "abhaId": "91-6965-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Divya Rawat",
        "age": 17,
        "gender": "महिला",
        "phone": 9876500016,
        "abhaId": "91-9895-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 17,
    "houseNo": 17,
    "familyName": "Mohd. Salim",
    "primaryPhone": 9876500017,
    "membersCount": 3,
    "status": "noData",
    "lastVisited": "null",
    "nextVisit": "नई जानकारी (No data)",
    "pregnancy": false,
    "child": false,
    "ncd": false,
    "members": [
      {
        "name": "Mohd. Salim",
        "age": 45,
        "gender": "पुरुष",
        "phone": 9876500017,
        "abhaId": "91-9032-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Yasmin Bano",
        "age": 40,
        "gender": "महिला",
        "phone": 9876500017,
        "abhaId": "91-1816-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Imran Salim",
        "age": 14,
        "gender": "पुरुष",
        "phone": 9876500017,
        "abhaId": "91-3041-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 18,
    "houseNo": 18,
    "familyName": "Santosh Paswan",
    "primaryPhone": 9876500018,
    "membersCount": 5,
    "status": "visited",
    "lastVisited": "23 Oct 2026",
    "nextVisit": "भेंट पूर्ण (Visited)",
    "pregnancy": false,
    "child": true,
    "ncd": false,
    "members": [
      {
        "name": "Santosh Paswan",
        "age": 36,
        "gender": "पुरुष",
        "phone": 9876500018,
        "abhaId": "91-7851-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Urmila Paswan",
        "age": 32,
        "gender": "महिला",
        "phone": 9876500018,
        "abhaId": "91-6443-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Chhotu Paswan",
        "age": 3,
        "gender": "बालक",
        "phone": 9876500018,
        "abhaId": "91-2233-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      },
      {
        "name": "Guddi Paswan",
        "age": 7,
        "gender": "महिला",
        "phone": 9876500018,
        "abhaId": "91-9413-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Somaru Paswan",
        "age": 63,
        "gender": "पुरुष",
        "phone": 9876500018,
        "abhaId": "91-9990-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 19,
    "houseNo": 19,
    "familyName": "Mamta Devi",
    "primaryPhone": 9876500019,
    "membersCount": 3,
    "status": "7days",
    "lastVisited": "11 Oct 2026",
    "nextVisit": "गंभीर (Severe)",
    "pregnancy": true,
    "child": false,
    "ncd": false,
    "members": [
      {
        "name": "Mamta Devi",
        "age": 27,
        "gender": "महिला",
        "phone": 9876500019,
        "abhaId": "91-9351-3847-5501",
        "condition": "सामान्य",
        "isPregnant": true,
        "isHrp": true,
        "childVaccine": null
      },
      {
        "name": "Vinod Kumar",
        "age": 30,
        "gender": "पुरुष",
        "phone": 9876500019,
        "abhaId": "91-1755-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Radha Kumari",
        "age": 4,
        "gender": "बालिका",
        "phone": 9876500019,
        "abhaId": "91-2547-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      }
    ]
  },
  {
    "id": 20,
    "houseNo": 20,
    "familyName": "Joseph D’Souza",
    "primaryPhone": 9876500020,
    "membersCount": 2,
    "status": "noData",
    "lastVisited": "null",
    "nextVisit": "नई जानकारी (No data)",
    "pregnancy": false,
    "child": false,
    "ncd": false,
    "members": [
      {
        "name": "Joseph D’Souza",
        "age": 40,
        "gender": "पुरुष",
        "phone": 9876500020,
        "abhaId": "91-9658-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Mary D’Souza",
        "age": 37,
        "gender": "महिला",
        "phone": 9876500020,
        "abhaId": "91-2805-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 21,
    "houseNo": 21,
    "familyName": "Vijay Tiwari",
    "primaryPhone": 9876500021,
    "membersCount": 4,
    "status": "15days",
    "lastVisited": "15 Oct 2026",
    "nextVisit": "मध्यम (Medium)",
    "pregnancy": false,
    "child": false,
    "ncd": true,
    "members": [
      {
        "name": "Vijay Tiwari",
        "age": 44,
        "gender": "पुरुष",
        "phone": 9876500021,
        "abhaId": "91-2586-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Sudha Tiwari",
        "age": 40,
        "gender": "महिला",
        "phone": 9876500021,
        "abhaId": "91-6274-3847-5501",
        "condition": "उच्च रक्तचाप / दीर्घकालिक",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Ankit Tiwari",
        "age": 16,
        "gender": "पुरुष",
        "phone": 9876500021,
        "abhaId": "91-3582-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Ruchi Tiwari",
        "age": 12,
        "gender": "महिला",
        "phone": 9876500021,
        "abhaId": "91-7095-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 22,
    "houseNo": 22,
    "familyName": "Govind Ram",
    "primaryPhone": 9876500022,
    "membersCount": 6,
    "status": "visited",
    "lastVisited": "24 Oct 2026",
    "nextVisit": "भेंट पूर्ण (Visited)",
    "pregnancy": false,
    "child": true,
    "ncd": false,
    "members": [
      {
        "name": "Govind Ram",
        "age": 53,
        "gender": "पुरुष",
        "phone": 9876500022,
        "abhaId": "91-5294-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Kamla Devi",
        "age": 49,
        "gender": "महिला",
        "phone": 9876500022,
        "abhaId": "91-2349-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Dinesh Kumar",
        "age": 25,
        "gender": "पुरुष",
        "phone": 9876500022,
        "abhaId": "91-1808-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Tara Devi",
        "age": 22,
        "gender": "महिला",
        "phone": 9876500022,
        "abhaId": "91-6595-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Krishna",
        "age": 1,
        "gender": "बालक",
        "phone": 9876500022,
        "abhaId": "91-5667-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      },
      {
        "name": "Bhagwati Devi",
        "age": 72,
        "gender": "महिला",
        "phone": 9876500022,
        "abhaId": "91-7023-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 23,
    "houseNo": 23,
    "familyName": "Manohar Lal",
    "primaryPhone": 9876500023,
    "membersCount": 4,
    "status": "30days",
    "lastVisited": "17 Oct 2026",
    "nextVisit": "सामान्य (Normal)",
    "pregnancy": false,
    "child": true,
    "ncd": false,
    "members": [
      {
        "name": "Manohar Lal",
        "age": 49,
        "gender": "पुरुष",
        "phone": 9876500023,
        "abhaId": "91-6239-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Maya Devi",
        "age": 45,
        "gender": "महिला",
        "phone": 9876500023,
        "abhaId": "91-1179-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Mohit Lal",
        "age": 4,
        "gender": "बालक",
        "phone": 9876500023,
        "abhaId": "91-9531-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": "नियमित टीकाकरण"
      },
      {
        "name": "Nisha Lal",
        "age": 19,
        "gender": "महिला",
        "phone": 9876500023,
        "abhaId": "91-4013-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  },
  {
    "id": 24,
    "houseNo": 24,
    "familyName": "Brijesh Pandey",
    "primaryPhone": 9876500024,
    "membersCount": 3,
    "status": "noData",
    "lastVisited": "null",
    "nextVisit": "नई जानकारी (No data)",
    "pregnancy": false,
    "child": false,
    "ncd": false,
    "members": [
      {
        "name": "Brijesh Pandey",
        "age": 37,
        "gender": "पुरुष",
        "phone": 9876500024,
        "abhaId": "91-4752-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Kalpana Pandey",
        "age": 33,
        "gender": "महिला",
        "phone": 9876500024,
        "abhaId": "91-1682-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      },
      {
        "name": "Ayush Pandey",
        "age": 8,
        "gender": "पुरुष",
        "phone": 9876500024,
        "abhaId": "91-4027-3847-5501",
        "condition": "सामान्य",
        "isPregnant": false,
        "isHrp": false,
        "childVaccine": null
      }
    ]
  }
];

export default function AshaFieldWorkerApp({ onSwitchRole }) {
  const toast = useToast();

  const [households, setHouseholds] = useState(INITIAL_HOUSEHOLDS);
  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'pregnancy' | 'child' | 'ncd'
  const [viewMode, setViewMode] = useState('grid');
  const [familySearchQuery, setFamilySearchQuery] = useState(''); // 'grid' | 'duelist'
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [outboxCount, setOutboxCount] = useState(3);

  // Referral to CHO State
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [referralTargetMember, setReferralTargetMember] = useState(null);
  const [referralTargetHouse, setReferralTargetHouse] = useState(null);
  const [referralReason, setReferralReason] = useState('गंभीर स्वास्थ्य जटिलता');
  const [referralUrgency, setReferralUrgency] = useState('urgent_7d');
  const [referralVitals, setReferralVitals] = useState('BP 140/90, Hb 10.2');
  const [inOutSyncModalOpen, setInOutSyncModalOpen] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  const handleOpenReferralModal = (house, member) => {
    setReferralTargetHouse(house);
    setReferralTargetMember(member);
    setReferralReason(
      member.isHrp
        ? 'गंभीर एनीमिया (Hb < 7 g/dL) - उच्च जोखिम गर्भावस्था'
        : member.anc
        ? 'गर्भावधि मधुमेह / रक्तचाप निगरानी'
        : member.childVaccine
        ? 'बाल कुपोषण एवं छूटा टीकाकरण'
        : member.condition
        ? member.condition
        : 'विस्तृत जांच एवं टेली-परामर्श'
    );
    setReferralVitals(
      member.hb ? `Hb: ${member.hb}` : member.condition?.includes('BP') ? 'BP: 185/110 mmHg' : 'वाइटल्स सामान्य'
    );
    setReferralModalOpen(true);
  };

  const handleConfirmReferralToCho = () => {
    toast.success(`✓ रोगी ${referralTargetMember?.name} को सफलतापूर्वक सीएचओ एडमिन को रेफर किया गया है।`);
    setOutboxCount((prev) => prev + 1);
    setReferralModalOpen(false);
  };

  // CBAC & Village Survey State
  const [surveyTargetMember, setSurveyTargetMember] = useState(null);
  const [surveyForm, setSurveyForm] = useState({
    ageGroup: '30-49',
    tobacco: 'कभी नहीं',
    alcohol: 'नहीं',
    waistCircumference: 'सामान्य',
    physicalActivity: 'हाँ (सक्रिय)',
    familyHistory: 'नहीं',
    cough2Weeks: 'नहीं',
    bloodSputum: 'नहीं',
    feverNightSweats: 'नहीं',
    skinPatches: 'नहीं',
    bpSystolic: '120',
    bpDiastolic: '80',
    hemoglobin: '11.5',
  });

  // Calculate CBAC Risk Score dynamically
  const calculateScore = () => {
    let score = 0;
    if (surveyForm.ageGroup === '30-49') score += 1;
    if (surveyForm.ageGroup === '>=50') score += 2;
    if (surveyForm.tobacco !== 'कभी नहीं') score += 2;
    if (surveyForm.alcohol === 'हाँ') score += 1;
    if (surveyForm.waistCircumference === 'अधिक (Obese)') score += 2;
    if (surveyForm.physicalActivity === 'नहीं (<150 min/wk)') score += 1;
    if (surveyForm.familyHistory === 'हाँ') score += 2;
    if (surveyForm.cough2Weeks === 'हाँ') score += 2;
    if (surveyForm.bloodSputum === 'हाँ') score += 3;
    if (surveyForm.skinPatches === 'हाँ') score += 2;
    return score;
  };

  const riskScore = calculateScore();

  // Voice narration in Hindi
  const playHindiAudio = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }
      const text = activeSection === 'pregnancy'
        ? 'गर्भावस्था एवं उच्च जोखिम प्रसव पूर्व जांच सूची। कृपया लाल एवं नारंगी मकानों का पहले दौरा करें।'
        : activeSection === 'child'
        ? 'शिशु टीकाकरण एवं पोषण जांच सूची। समय पर टीके लगवाना सुनिश्चित करें।'
        : activeSection === 'ncd'
        ? 'दीर्घकालिक रोग एवं बीपी शुगर स्क्रीनिंग सूची।'
        : 'आशा कार्यकर्ता ग्राम सूची ग्रिड। 24 परिवारों की निगरानी सक्रिय है।';

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'hi-IN';
      utter.rate = 0.95;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utter);
    } else {
      toast.info('ऑडियो मार्गदर्शन: कृपया उच्च प्राथमिकता वाले मकानों का प्राथमिकता से दौरा करें।');
    }
  };

  // Sync Outbox
  const handleSyncOutbox = async () => {
    setSyncing(true);
    try {
      const payload = {
        families: households.map((h) => ({
          sequentialNumber: h.id,
          houseNumber: h.houseNo.toString(),
          headName: h.familyName,
          primaryPhone: h.primaryPhone,
          villageName: 'Chandpur',
          visitIntervalDays: h.status === '7days' ? 7 : h.status === '15days' ? 15 : 30,
          nextVisitDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        })),
        members: households.flatMap((h) =>
          (h.members || []).map((m) => ({
            familyUnitId: h.id,
            name: m.name,
            age: m.age || 30,
            gender: m.gender === 'महिला' || m.gender === 'बालिका' ? 'Female' : 'Male',
            relationship: 'सदस्य',
            phone: m.phone || h.primaryPhone,
            dob: '1995-01-01',
          }))
        ),
        surveys: [],
        followUps: [],
      };
      const res = await syncApi.upload(payload, '9876543210');
      const accepted = res?.data?.accepted ?? 24;
      setOutboxCount(0);
      toast.success(`✓ सभी 24 परिवारों और सदस्यों का डेटा क्लाउड सर्वर पर प्रेषित हो गया! (स्वीकृत: ${accepted})`);
    } catch (e) {
      toast.error('सिंक विफल रहा: ' + (e.message || 'क्लाउड सर्वर से संपर्क नहीं हो सका'));
    } finally {
      setSyncing(false);
    }
  };

  // Filter households by section
  const filteredHouses = households.filter((h) => {
    if (activeSection === 'pregnancy') return h.pregnancy;
    if (activeSection === 'child') return h.child;
    if (activeSection === 'ncd') return h.ncd;
    return true;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case '7days': return { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', dot: '#e11d48', label: '7 दिन' };
      case '15days': return { bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d', dot: '#db2777', label: '15 दिन' };
      case '30days': return { bg: '#fffbeb', border: '#fde68a', text: '#b45309', dot: '#d97706', label: '30 दिन' };
      case 'visited': return { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', dot: '#059669', label: 'भेंट पूर्ण' };
      default: return { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', dot: '#94a3b8', label: 'जानकारी बाकी' };
    }
  };

  const handleStartSurvey = (house, member = null) => {
    setSelectedHouse(house);
    setSurveyTargetMember(member || house.members[0]);
    setSurveyModalOpen(true);
  };

  const handleSubmitSurvey = (e) => {
    e.preventDefault();
    if (selectedHouse) {
      setHouseholds((prev) =>
        prev.map((h) => (h.id === selectedHouse.id ? { ...h, status: 'visited', lastVisited: 'अभी', nextVisit: '30 दिन शेष' } : h))
      );
      setOutboxCount((c) => c + 1);
      toast.success(`मकान #${selectedHouse.houseNo} (${surveyTargetMember?.name || selectedHouse.familyName}) का सर्वेक्षण आउटबॉक्स में सुरक्षित किया गया!`);
      setSurveyModalOpen(false);
      setSelectedHouse(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. TOP ASHA WORKER BANNER */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1.5px solid #86efac',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 2px 8px rgba(22, 163, 74, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#dcfce7',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '800',
              }}
            >
              👩‍🌾
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
                सुनीता देवी • आशा कार्यकर्ता (ASHA)
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                ग्राम: चांदपुर • उप-केंद्र: रामपुर • सेक्टर 4
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Sync Button */}
            <button
              type="button"
              onClick={handleSyncOutbox}
              disabled={syncing || outboxCount === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                backgroundColor: outboxCount > 0 ? '#eff6ff' : '#f8fafc',
                color: outboxCount > 0 ? '#1d4ed8' : '#64748b',
                border: outboxCount > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: outboxCount > 0 ? 'pointer' : 'default',
              }}
              title="Sync pending surveys to ABDM"
            >
              <Send size={13} />
              <span>{syncing ? 'सिंक हो रहा है...' : `आउटबॉक्स (${outboxCount})`}</span>
            </button>

            {/* Role switch button */}
            <button
              type="button"
              onClick={onSwitchRole}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #93c5fd',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
              title="Switch to CHO Supervisor view"
            >
              <RefreshCw size={12} />
              <span>सीएचओ कंसोल</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            padding: '10px',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>24</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>कुल मकान</div>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#e11d48' }}>5</div>
            <div style={{ fontSize: '11px', color: '#e11d48', fontWeight: 600 }}>7 दिन (गंभीर)</div>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#d97706' }}>6</div>
            <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>15 दिन (मध्यम)</div>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#059669' }}>9</div>
            <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>भेंट पूर्ण</div>
          </div>
        </div>
      </div>

      {/* 2. HINDI VOICE GUIDE BANNER */}
      <div
        onClick={playHindiAudio}
        style={{
          backgroundColor: '#f0fdf4',
          border: '1.5px solid #86efac',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 size={18} color="#15803d" />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>
            {isSpeaking ? 'ऑडियो चल रहा है (रोकने के लिए क्लिक करें)...' : 'बोलकर सुनें / ऑडियो मार्गदर्शन (Hindi Voice)'}
          </span>
        </div>
        <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
          {isSpeaking ? 'सक्रिय' : 'सुनें ▶'}
        </span>
      </div>

      {/* 3. ACTIVITY SWITCHER (All | Pregnancy | Child | NCD) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
        }}
      >
        {[
          { key: 'all', label: 'सभी परिवार', icon: LayoutGrid, count: households.length },
          { key: 'pregnancy', label: 'गर्भावस्था', icon: Baby, count: households.filter(h => h.pregnancy).length },
          { key: 'child', label: 'शिशु टीका', icon: Syringe, count: households.filter(h => h.child).length },
          { key: 'ncd', label: 'दीर्घकालिक', icon: HeartPulse, count: households.filter(h => h.ncd).length },
        ].map((tab) => {
          const IconC = tab.icon;
          const active = activeSection === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSection(tab.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 4px',
                borderRadius: '10px',
                border: active ? '1.5px solid #004d40' : '1px solid #e2e8f0',
                backgroundColor: active ? '#004d40' : '#ffffff',
                color: active ? '#ffffff' : '#334155',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <IconC size={16} color={active ? '#ffffff' : '#004d40'} />
              <span style={{ fontSize: '11.5px', fontWeight: '700' }}>{tab.label}</span>
              <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: '600' }}>({tab.count})</span>
            </button>
          );
        })}
      </div>

      {/* 4. VIEW MODE TOGGLE (Grid vs Due List) & LEGEND */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#e2e8f0', padding: '2px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: viewMode === 'grid' ? '#ffffff' : 'transparent',
              color: viewMode === 'grid' ? '#0f172a' : '#64748b',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            सूचि ग्रिड
          </button>
          <button
            type="button"
            onClick={() => setViewMode('duelist')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: viewMode === 'duelist' ? '#ffffff' : 'transparent',
              color: viewMode === 'duelist' ? '#0f172a' : '#64748b',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            ड्यू लिस्ट ({filteredHouses.filter(h => h.status !== 'visited').length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('families')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: viewMode === 'families' ? '#ffffff' : 'transparent',
              color: viewMode === 'families' ? '#0f172a' : '#64748b',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            परिवार सूची (24)
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626' }} /> 7d</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ea580c' }} /> 15d</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ca8a04' }} /> 30d</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }} /> पूर्ण</span>
        </div>
      </div>

      {/* 5. MAIN CONTENT: SUCHI GRID OR DUE LIST */}
      {viewMode === 'grid' ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>
            मकान सूची (Household Dot Matrix) • किसी भी मकान पर क्लिक कर विवरण देखें:
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
              gap: '10px',
            }}
          >
            {filteredHouses.map((h) => {
              const sc = getStatusColor(h.status);
              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedHouse(h)}
                  style={{
                    backgroundColor: sc.bg,
                    border: `1.5px solid ${sc.border}`,
                    borderRadius: '12px',
                    padding: '8px 4px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: sc.dot }} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: sc.text }}>
                    #{h.houseNo}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 2px' }}>
                    {h.familyName.split(' ')[0]}
                  </div>
                  {h.pregnancy && <span style={{ fontSize: '10px' }} title="गर्भवती">🤰</span>}
                  {h.child && <span style={{ fontSize: '10px' }} title="शिशु">👶</span>}
                  {h.ncd && <span style={{ fontSize: '10px' }} title="बीपी / शुगर">🩺</span>}
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'duelist' ? (
        /* DUE LIST VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredHouses.map((h) => {
            const sc = getStatusColor(h.status);
            return (
              <div
                key={h.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: sc.bg,
                      color: sc.text,
                      border: `1px solid ${sc.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '13px',
                    }}
                  >
                    #{h.houseNo}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                      {h.familyName} ({h.membersCount} सदस्य)
                    </div>
                    <div style={{ fontSize: '12px', color: sc.text, fontWeight: '600', marginTop: '2px' }}>
                      {sc.label} • अंतिम भेंट: {h.lastVisited}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartSurvey(h)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#004d40',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>जांच</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* 3. FAMILIES LIST VIEW (All 24 Families & Members) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Search Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            border: '1.5px solid #cbd5e1',
            borderRadius: '12px',
            padding: '8px 12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            <Search size={16} color="#64748b" style={{ marginRight: '8px' }} />
            <input
              type="text"
              placeholder="मकान नंबर, मुखिया या सदस्य के नाम से खोजें..."
              value={familySearchQuery}
              onChange={(e) => setFamilySearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                color: '#0f172a'
              }}
            />
            {familySearchQuery && (
              <button
                type="button"
                onClick={() => setFamilySearchQuery('')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
            गाँव के कुल 24 परिवार एवं 94 पंजीकृत सदस्य:
          </div>

          {filteredHouses
            .filter((h) => {
              if (!familySearchQuery) return true;
              const q = familySearchQuery.toLowerCase().trim();
              if (h.houseNo.toString().includes(q)) return true;
              if (h.familyName.toLowerCase().includes(q)) return true;
              return (h.members || []).some(m => m.name.toLowerCase().includes(q));
            })
            .map((h) => {
              const sc = getStatusColor(h.status);
              return (
                <div
                  key={`fam-${h.id}`}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          backgroundColor: sc.bg,
                          color: sc.text,
                          border: `1.5px solid ${sc.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '800',
                          fontSize: '14px',
                        }}
                      >
                        #{h.houseNo}
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                          {h.familyName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          📞 {h.primaryPhone} • {h.members?.length || h.membersCount} सदस्य
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: sc.bg,
                          color: sc.text,
                          border: `1px solid ${sc.border}`
                        }}
                      >
                        {sc.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedHouse(h)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#004d40',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>सदस्य</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Members tags preview */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(h.members || []).map((m, idx) => (
                      <div
                        key={`m-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11.5px',
                          color: '#334155'
                        }}
                      >
                        <span style={{ fontWeight: '700' }}>{m.name}</span>
                        <span style={{ color: '#64748b' }}>({m.gender}, {m.age} वर्ष)</span>
                        {m.isPregnant && <span title="गर्भवती">🤰</span>}
                        {m.childVaccine && <span title="टीकाकरण">👶</span>}
                        {m.condition && m.condition !== 'सामान्य' && <span title="स्वास्थ्य स्थिति">🩺</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* 6. FAMILY DETAIL BOTTOM SHEET / MODAL */}
      {selectedHouse && !surveyModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setSelectedHouse(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '20px',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 -10px 25px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Head */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>
                  मकान #{selectedHouse.houseNo} विवरण
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  {selectedHouse.familyName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHouse(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Visit status */}
            <div
              style={{
                backgroundColor: getStatusColor(selectedHouse.status).bg,
                border: `1px solid ${getStatusColor(selectedHouse.status).border}`,
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '12.5px',
                color: getStatusColor(selectedHouse.status).text,
                fontWeight: '600',
                marginBottom: '14px',
              }}
            >
              स्थिति: {getStatusColor(selectedHouse.status).label} • अगली भेंट: {selectedHouse.nextVisit}
            </div>

            {/* Family Members Table */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                परिवार के सदस्य ({selectedHouse.members.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedHouse.members.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{m.name}</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{m.gender}, {m.age} वर्ष</span>
                    </div>

                    {/* Attached Contact Number & ABHA ID Number */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0', flexWrap: 'wrap' }}>
                      {m.phone && (
                        <a
                          href={`tel:${m.phone}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textDecoration: 'none',
                          }}
                        >
                          <Phone size={10} color="#1d4ed8" />
                          <span>{m.phone}</span>
                          <span style={{ fontSize: '9px', backgroundColor: '#dbeafe', padding: '1px 3px', borderRadius: '3px' }}>कॉल</span>
                        </a>
                      )}
                      {m.abhaId && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            backgroundColor: '#ecfdf5',
                            color: '#047857',
                            border: '1px solid #a7f3d0',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                          }}
                        >
                          <span>ABHA:</span>
                          <span>{m.abhaId}</span>
                        </span>
                      )}
                    </div>

                    {m.condition && (
                      <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: '600', marginTop: '4px' }}>
                        ⚠️ {m.condition}
                      </div>
                    )}
                    {m.anc && (
                      <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: '600', marginTop: '4px' }}>
                        🤰 {m.anc} • Hb: {m.hb || '9.5'}
                      </div>
                    )}
                    {m.childVaccine && (
                      <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: '600', marginTop: '4px' }}>
                        💉 {m.childVaccine}
                      </div>
                    )}

                    {/* Doctor Prescriptions & Deadlines */}
                    {m.prescriptions && (
                      <div
                        style={{
                          backgroundColor: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          marginTop: '5px',
                          fontSize: '11px',
                        }}
                      >
                        <div style={{ fontWeight: '800', color: '#92400e' }}>
                          💊 डॉक्टर दवा सलाह: {m.prescriptions}
                        </div>
                        {m.prescriptionDeadline && (
                          <div style={{ color: '#dc2626', fontWeight: '700', marginTop: '2px' }}>
                            ⏰ समयसीमा: {m.prescriptionDeadline}
                          </div>
                        )}
                        {m.doctorName && (
                          <div style={{ color: '#64748b', fontSize: '10px', marginTop: '1px' }}>
                            डॉक्टर: {m.doctorName}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dual Action Buttons: Survey & Direct Referral to CHO */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleStartSurvey(selectedHouse, m)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          color: '#004d40',
                          cursor: 'pointer',
                        }}
                      >
                        📋 CBAC जांच &rarr;
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenReferralModal(selectedHouse, m)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          backgroundColor: '#eff6ff',
                          border: '1.5px solid #3b82f6',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          color: '#1d4ed8',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <Building2 size={13} color="#1d4ed8" />
                        <span>सीएचओ को रेफर करें</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Start Full Survey Button */}
            <button
              type="button"
              onClick={() => handleStartSurvey(selectedHouse)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#004d40',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(0, 77, 64, 0.25)',
              }}
            >
              <FileText size={16} />
              <span>नया ग्राम सर्वेक्षण एवं CBAC फॉर्म भरें</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. INTERACTIVE CBAC & MATERNAL SCREENING SURVEY MODAL */}
      {surveyModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setSurveyModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '20px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>
                  CBAC &amp; NCD फील्ड सर्वेक्षण
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                  {surveyTargetMember?.name || selectedHouse?.familyName} (मकान #{selectedHouse?.houseNo})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSurveyModalOpen(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Real-time Risk Score Box */}
            <div
              style={{
                backgroundColor: riskScore >= 4 ? '#fef2f2' : '#f0fdf4',
                border: riskScore >= 4 ? '1.5px solid #f87171' : '1.5px solid #86efac',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', color: riskScore >= 4 ? '#b91c1c' : '#166534', fontWeight: '700' }}>
                  {riskScore >= 4 ? '⚠️ उच्च जोखिम स्कोर (सीएचओ / पीएचसी रेफरल आवश्यक)' : '✓ सामान्य जोखिम स्कोर'}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                  4 या अधिक अंक होने पर मरीज को उच्च केंद्र भेजा जाना चाहिए।
                </div>
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '900',
                  color: riskScore >= 4 ? '#dc2626' : '#15803d',
                  backgroundColor: riskScore >= 4 ? '#fee2e2' : '#dcfce7',
                  padding: '4px 12px',
                  borderRadius: '10px',
                }}
              >
                {riskScore} / 15
              </div>
            </div>

            {/* Questions Form */}
            <form onSubmit={handleSubmitSurvey} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Q1: Age */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  1. लाभार्थी की आयु (Age Group)
                </label>
                <select
                  value={surveyForm.ageGroup}
                  onChange={(e) => setSurveyForm({ ...surveyForm, ageGroup: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="<30">30 वर्ष से कम (0 अंक)</option>
                  <option value="30-49">30 से 49 वर्ष (1 अंक)</option>
                  <option value=">=50">50 वर्ष या अधिक (2 अंक)</option>
                </select>
              </div>

              {/* Q2: Tobacco */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  2. क्या तंबाकू या बीड़ी/गुटखा का सेवन करते हैं?
                </label>
                <select
                  value={surveyForm.tobacco}
                  onChange={(e) => setSurveyForm({ ...surveyForm, tobacco: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="कभी नहीं">कभी नहीं (0 अंक)</option>
                  <option value="पहले करते थे">पहले करते थे पर अब छोड़ दिया (1 अंक)</option>
                  <option value="प्रतिदिन">हाँ, नियमित रूप से करते हैं (2 अंक)</option>
                </select>
              </div>

              {/* Q3: Cough > 2 weeks (TB Screening) */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  3. क्या 2 सप्ताह से अधिक समय से खांसी है? (टीबी जांच)
                </label>
                <select
                  value={surveyForm.cough2Weeks}
                  onChange={(e) => setSurveyForm({ ...surveyForm, cough2Weeks: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="नहीं">नहीं (0 अंक)</option>
                  <option value="हाँ">हाँ, 2 हफ्ते से खांसी है (2 अंक)</option>
                </select>
              </div>

              {/* Q4: BP & Vitals */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  4. रक्तचाप (Blood Pressure mmHg)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="सिस्टोलिक (120)"
                    value={surveyForm.bpSystolic}
                    onChange={(e) => setSurveyForm({ ...surveyForm, bpSystolic: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                  <input
                    type="number"
                    placeholder="डायस्टोलिक (80)"
                    value={surveyForm.bpDiastolic}
                    onChange={(e) => setSurveyForm({ ...surveyForm, bpDiastolic: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Q5: Hemoglobin (for pregnant women) */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  5. हीमोग्लोबिन (Hb g/dL) • 11 से कम होने पर एनीमिया HRP
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={surveyForm.hemoglobin}
                  onChange={(e) => setSurveyForm({ ...surveyForm, hemoglobin: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Check size={16} />
                  <span>सबमिट करें एवं आउटबॉक्स में जोड़ें</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSurveyModalOpen(false)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  रद्द करें
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REFERRAL TO CHO ADMIN MODAL */}
      {referralModalOpen && referralTargetMember && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setReferralModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '22px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={20} color="#1d4ed8" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    सीएचओ एडमिन को रेफरल प्रेषित करें
                  </h3>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                    आयुष्मान आरोग्य मंदिर • कम्युनिटी हेल्थ ऑफिसर
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReferralModalOpen(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Beneficiary Quick Summary Card */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>
                  {referralTargetMember.name} ({referralTargetMember.age} वर्ष · {referralTargetMember.gender})
                </div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#0284c7' }}>
                  घर सं. #{referralTargetHouse?.houseNo}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                {referralTargetMember.phone && (
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', backgroundColor: '#eff6ff', padding: '2px 7px', borderRadius: '4px' }}>
                    📞 {referralTargetMember.phone}
                  </span>
                )}
                {referralTargetMember.abhaId && (
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', backgroundColor: '#ecfdf5', padding: '2px 7px', borderRadius: '4px' }}>
                    ABHA: {referralTargetMember.abhaId}
                  </span>
                )}
              </div>
            </div>

            {/* Urgency Level */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                प्राथमिकता स्तर (Urgency Tier):
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setReferralUrgency('urgent_7d')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: referralUrgency === 'urgent_7d' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                    backgroundColor: referralUrgency === 'urgent_7d' ? '#fef2f2' : '#ffffff',
                    color: referralUrgency === 'urgent_7d' ? '#b91c1c' : '#475569',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                  }}
                >
                  अति-आवश्यक (7 दिन)
                </button>
                <button
                  type="button"
                  onClick={() => setReferralUrgency('semi_urgent_14d')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: referralUrgency === 'semi_urgent_14d' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: referralUrgency === 'semi_urgent_14d' ? '#eff6ff' : '#ffffff',
                    color: referralUrgency === 'semi_urgent_14d' ? '#1d4ed8' : '#475569',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                  }}
                >
                  मध्यम (14 दिन)
                </button>
              </div>
            </div>

            {/* Reason for Referral */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                रेफरल का मुख्य कारण:
              </label>
              <input
                type="text"
                value={referralReason}
                onChange={(e) => setReferralReason(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                placeholder="उदा. गंभीर एनीमिया, उच्च रक्तचाप, प्रसव पूर्व जटिलता"
              />
            </div>

            {/* Vitals */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                नवीनतम वाइटल्स एवं जाँच:
              </label>
              <input
                type="text"
                value={referralVitals}
                onChange={(e) => setReferralVitals(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                placeholder="उदा. BP 185/110 mmHg, Hb 6.8 g/dL"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleConfirmReferralToCho}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#1d4ed8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(29, 78, 216, 0.25)',
                }}
              >
                <Send size={15} />
                <span>सीएचओ एडमिन को रेफरल भेजें</span>
              </button>
              <button
                type="button"
                onClick={() => setReferralModalOpen(false)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                रद्द करें
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
