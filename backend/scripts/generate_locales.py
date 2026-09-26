import json
from pathlib import Path
import copy

translations = {
  "en": {
    "landing": {
      "patient_title": "Stroke Patient",
      "patient_desc": "Follow your prescribed recovery exercises, track your daily progress, and stay in touch with your clinician.",
      "patient_btn": "I'm a Patient",
      "clinician_title": "Clinician",
      "clinician_desc": "Monitor patient motor recovery metrics, assign tailored tele-rehab regimens, and review progress.",
      "clinician_btn": "I'm a Clinician",
    },
    "navbar": {
      "platform": "Stroke Recovery Platform",
      "text_size": "Text Size:",
      "sign_out": "Sign Out",
      "sign_in": "Sign In",
      "get_started": "Get Started",
      "patient": "Patient",
      "clinician": "Clinician"
    },
    "speech": {
      "rep_complete": "Good job! Repetition complete.",
      "extend_further": "Extend your knee a little further.",
      "hips_level": "Try to keep your hips level.",
      "start_session": "Let's begin your session. Get into position.",
      "end_session": "Session complete. Great work today!"
    },
    "auth": {
      "login_title": "Welcome back",
      "signup_title": "Create your account",
      "email": "Email address",
      "password": "Password",
      "full_name": "Full Name",
      "license": "Medical License Number",
      "submit_login": "Sign in",
      "submit_signup": "Create account",
      "toggle_signup": "Don't have an account? Sign up",
      "toggle_login": "Already have an account? Sign in"
    },
    "dashboard": {
      "welcome": "Welcome back",
      "start_exercise": "Start Exercise",
      "caseload": "Patient Caseload",
      "recent_activity": "Recent Activity",
      "progress": "Recovery Progress"
    }
  },
  "hi": {
    "landing": {
      "patient_title": "स्ट्रोक मरीज",
      "patient_desc": "अपने निर्धारित रिकवरी व्यायामों का पालन करें, अपनी प्रगति ट्रैक करें और अपने डॉक्टर के संपर्क में रहें।",
      "patient_btn": "मैं एक मरीज हूँ",
      "clinician_title": "क्लिनिशियन",
      "clinician_desc": "मरीजों की मोटर रिकवरी की निगरानी करें, टेली-रिहैब रेजिमेन असाइन करें और प्रगति की समीक्षा करें।",
      "clinician_btn": "मैं एक क्लिनिशियन हूँ"
    },
    "navbar": {
      "platform": "स्ट्रोक रिकवरी प्लेटफार्म",
      "text_size": "टेक्स्ट का आकार:",
      "sign_out": "साइन आउट",
      "sign_in": "साइन इन",
      "get_started": "शुरू करें",
      "patient": "मरीज",
      "clinician": "क्लिनिशियन"
    },
    "speech": {
      "rep_complete": "बहुत बढ़िया! एक बार पूरा हुआ।",
      "extend_further": "अपने घुटने को थोड़ा और फैलाएं।",
      "hips_level": "अपने कूल्हों को सीधा रखने की कोशिश करें।",
      "start_session": "चलिए आपका सत्र शुरू करते हैं। अपनी जगह लें।",
      "end_session": "सत्र पूरा हुआ। आज बहुत अच्छा काम किया!"
    },
    "auth": {
      "login_title": "वापसी पर स्वागत है",
      "signup_title": "अपना खाता बनाएं",
      "email": "ईमेल पता",
      "password": "पासवर्ड",
      "full_name": "पूरा नाम",
      "license": "मेडिकल लाइसेंस नंबर",
      "submit_login": "साइन इन करें",
      "submit_signup": "खाता बनाएं",
      "toggle_signup": "खाता नहीं है? साइन अप करें",
      "toggle_login": "पहले से खाता है? साइन इन करें"
    },
    "dashboard": {
      "welcome": "वापसी पर स्वागत है",
      "start_exercise": "व्यायाम शुरू करें",
      "caseload": "मरीज का विवरण",
      "recent_activity": "हाल की गतिविधि",
      "progress": "रिकवरी की प्रगति"
    }
  },
  "ta": {
    "landing": {
      "patient_title": "பக்கவாத நோயாளி",
      "patient_desc": "உங்கள் பரிந்துரைக்கப்பட்ட மீட்புப் பயிற்சிகளைப் பின்பற்றுங்கள், உங்கள் முன்னேற்றத்தைக் கண்காணிக்கவும் மற்றும் உங்கள் மருத்துவருடன் தொடர்பில் இருக்கவும்.",
      "patient_btn": "நான் ஒரு நோயாளி",
      "clinician_title": "மருத்துவர்",
      "clinician_desc": "நோயாளியின் மோட்டார் மீட்பு அளவீடுகளைக் கண்காணிக்கவும், தொலை-மறுவாழ்வு முறைகளை ஒதுக்கவும் மற்றும் முன்னேற்றத்தை மதிப்பாய்வு செய்யவும்.",
      "clinician_btn": "நான் ஒரு மருத்துவர்"
    },
    "navbar": {
      "platform": "பக்கவாத மீட்பு தளம்",
      "text_size": "உரை அளவு:",
      "sign_out": "வெளியேறு",
      "sign_in": "உள்நுழைக",
      "get_started": "தொடங்கு",
      "patient": "நோயாளி",
      "clinician": "மருத்துவர்"
    },
    "speech": {
      "rep_complete": "நன்று! ஒரு முறை முடிந்தது.",
      "extend_further": "உங்கள் முழங்காலை இன்னும் கொஞ்சம் நீட்டவும்.",
      "hips_level": "உங்கள் இடுப்பை நேராக வைத்திருக்க முயற்சிக்கவும்.",
      "start_session": "உங்கள் அமர்வைத் தொடங்குவோம். தயாராகுங்கள்.",
      "end_session": "அமர்வு முடிந்தது. இன்று மிகச் சிறப்பான வேலை!"
    },
    "auth": {
      "login_title": "மீண்டும் வரவேற்கிறோம்",
      "signup_title": "உங்கள் கணக்கை உருவாக்கவும்",
      "email": "மின்னஞ்சல் முகவரி",
      "password": "கடவுச்சொல்",
      "full_name": "முழு பெயர்",
      "license": "மருத்துவ உரிம எண்",
      "submit_login": "உள்நுழைக",
      "submit_signup": "கணக்கை உருவாக்கு",
      "toggle_signup": "கணக்கு இல்லையா? பதிவு செய்யவும்",
      "toggle_login": "ஏற்கனவே கணக்கு உள்ளதா? உள்நுழைக"
    },
    "dashboard": {
      "welcome": "மீண்டும் வரவேற்கிறோம்",
      "start_exercise": "பயிற்சியைத் தொடங்கு",
      "caseload": "நோயாளிகள் பட்டியல்",
      "recent_activity": "சமீபத்திய செயல்பாடு",
      "progress": "மீட்பு முன்னேற்றம்"
    }
  }
}

other_langs = ['te', 'ml', 'bn', 'kn', 'mr', 'as']

for lang in other_langs:
    translations[lang] = copy.deepcopy(translations["en"])
    for section in translations[lang]:
        for key in translations[lang][section]:
            translations[lang][section][key] = f"[{lang}] {translations[lang][section][key]}"

locales_dir = Path(__file__).resolve().parent.parent.parent / 'src' / 'locales'
locales_dir.mkdir(parents=True, exist_ok=True)

for lang, data in translations.items():
    file_path = locales_dir / f"{lang}.json"
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

print('Locale files generated.')
