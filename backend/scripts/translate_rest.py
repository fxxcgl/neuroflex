import json
import os
from pathlib import Path

new_translations = {
  "en": {
    "clinician": {
      "loading": "Loading clinician caseload & telemetry...",
      "portal_title": "NeuroFlex Clinician Portal",
      "subtitle": "Stroke Tele-Rehabilitation Caseload & Kinematic Telemetry",
      "caseload": "Caseload",
      "patients_count": "{{count}} Patients",
      "risk_alerts": "Risk Alerts",
      "active_count": "{{count}} Active",
      "caseload_title": "Patient Caseload",
      "select_patient": "Select a patient to inspect telemetry and update prescription",
      "patient_header": "Patient",
      "status_header": "Status",
      "adherence_header": "Adherence",
      "optimal": "Optimal",
      "moderate": "Moderate",
      "at_risk": "At Risk"
    },
    "auth": {
      "login_title": "Welcome back",
      "signup_title": "Create your account",
      "email": "Email address",
      "password": "Password",
      "submit": "Submit"
    }
  },
  "hi": {
    "clinician": {
      "loading": "क्लिनिशियन केसलोड और टेलीमेट्री लोड हो रहा है...",
      "portal_title": "न्यूरोफ्लेक्स क्लिनिशियन पोर्टल",
      "subtitle": "स्ट्रोक टेली-रिहैबिलिटेशन केसलोड और किनेमेटिक टेलीमेट्री",
      "caseload": "केसलोड",
      "patients_count": "{{count}} मरीज",
      "risk_alerts": "जोखिम अलर्ट",
      "active_count": "{{count}} सक्रिय",
      "caseload_title": "मरीज केसलोड",
      "select_patient": "टेलीमेट्री का निरीक्षण करने और नुस्खा अपडेट करने के लिए एक मरीज का चयन करें",
      "patient_header": "मरीज",
      "status_header": "स्थिति",
      "adherence_header": "अनुपालन",
      "optimal": "इष्टतम",
      "moderate": "मध्यम",
      "at_risk": "जोखिम में"
    },
    "auth": {
      "login_title": "वापसी पर स्वागत है",
      "signup_title": "अपना खाता बनाएं",
      "email": "ईमेल पता",
      "password": "पासवर्ड",
      "submit": "जमा करें"
    }
  },
  "bn": {
    "clinician": {
      "loading": "ক্লিনিশিয়ান কেসলোড এবং টেলিমেট্রি লোড হচ্ছে...",
      "portal_title": "নিউরোফ্লেক্স ক্লিনিশিয়ান পোর্টাল",
      "subtitle": "স্ট্রোক টেলি-রিহ্যাবিলিটেশন কেসলোড এবং কাইনেম্যাটিক টেলিমেট্রি",
      "caseload": "কেসলোড",
      "patients_count": "{{count}} জন রোগী",
      "risk_alerts": "ঝুঁকি সতর্কতা",
      "active_count": "{{count}} টি সক্রিয়",
      "caseload_title": "রোগীর কেসলোড",
      "select_patient": "টেলিমেট্রি পরিদর্শন এবং প্রেসক্রিপশন আপডেট করতে একজন রোগী নির্বাচন করুন",
      "patient_header": "রোগী",
      "status_header": "স্ট্যাটাস",
      "adherence_header": "সম্মতি",
      "optimal": "সর্বোত্তম",
      "moderate": "মাঝারি",
      "at_risk": "ঝুঁকিতে"
    },
    "auth": {
      "login_title": "আবার স্বাগতম",
      "signup_title": "আপনার অ্যাকাউন্ট তৈরি করুন",
      "email": "ইমেইল ঠিকানা",
      "password": "পাসওয়ার্ড",
      "submit": "জমা দিন"
    }
  },
  "ta": {
    "clinician": {
      "loading": "மருத்துவர் கேஸ்லோட் மற்றும் டெலிமெட்ரி ஏற்றப்படுகிறது...",
      "portal_title": "நியூரோஃப்ளெக்ஸ் மருத்துவர் தளம்",
      "subtitle": "பக்கவாத தொலை-மறுவாழ்வு கேஸ்லோட் மற்றும் கினமேடிக் டெலிமெட்ரி",
      "caseload": "கேஸ்லோட்",
      "patients_count": "{{count}} நோயாளிகள்",
      "risk_alerts": "ஆபத்து எச்சரிக்கைகள்",
      "active_count": "{{count}} செயலில்",
      "caseload_title": "நோயாளி கேஸ்லோட்",
      "select_patient": "டெலிமெட்ரியை ஆய்வு செய்ய நோயாளியைத் தேர்ந்தெடுக்கவும்",
      "patient_header": "நோயாளி",
      "status_header": "நிலை",
      "adherence_header": "இணக்கம்",
      "optimal": "உகந்தது",
      "moderate": "மிதமானது",
      "at_risk": "ஆபத்தில்"
    },
    "auth": {
      "login_title": "மீண்டும் வருக",
      "signup_title": "உங்கள் கணக்கை உருவாக்கவும்",
      "email": "மின்னஞ்சல் முகவரி",
      "password": "கடவுச்சொல்",
      "submit": "சமர்ப்பி"
    }
  },
  "te": {
    "clinician": {
      "loading": "క్లినిషియన్ కేస్‌లోడ్ మరియు టెలిమెట్రీ లోడ్ అవుతోంది...",
      "portal_title": "న్యూరోఫ్లెక్స్ క్లినిషియన్ పోర్టల్",
      "subtitle": "స్ట్రోక్ టెలి-రిహాబిలిటేషన్ కేస్‌లోడ్ మరియు కైనమాటిక్ టెలిమెట్రీ",
      "caseload": "కేస్‌లోడ్",
      "patients_count": "{{count}} రోగులు",
      "risk_alerts": "ప్రమాద హెచ్చరికలు",
      "active_count": "{{count}} యాక్టివ్",
      "caseload_title": "రోగి కేస్‌లోడ్",
      "select_patient": "టెలిమెట్రీని తనిఖీ చేయడానికి రోగిని ఎంచుకోండి",
      "patient_header": "రోగి",
      "status_header": "స్థితి",
      "adherence_header": "కట్టుబడి",
      "optimal": "అత్యుత్తమ",
      "moderate": "మధ్యస్థ",
      "at_risk": "ప్రమాదంలో"
    },
    "auth": {
      "login_title": "తిరిగి స్వాగతం",
      "signup_title": "మీ ఖాతాను సృష్టించండి",
      "email": "ఈమెయిల్ చిరునామా",
      "password": "పాస్వర్డ్",
      "submit": "సమర్పించండి"
    }
  }
}

langs = ['en', 'hi', 'bn', 'ta', 'te', 'ml', 'kn', 'mr', 'as']
locales_dir = Path(__file__).resolve().parent.parent.parent / 'src' / 'locales'

for lang in langs:
    file_path = locales_dir / f"{lang}.json"
    data = {}
    if file_path.exists():
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
    trans = new_translations.get(lang, new_translations['en'])
    
    if 'clinician' not in data:
        data['clinician'] = {}
    data['clinician'].update(trans['clinician'])
    
    if 'auth' not in data:
        data['auth'] = {}
    data['auth'].update(trans['auth'])
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

print('Rest of locales appended!')
