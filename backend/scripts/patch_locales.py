import json
from pathlib import Path

locales_dir = Path(__file__).resolve().parent.parent.parent / 'src' / 'locales'

ta_path = locales_dir / 'ta.json'
with open(ta_path, 'r', encoding='utf-8') as f:
    ta_data = json.load(f)

if 'dashboard' not in ta_data:
    ta_data['dashboard'] = {}
ta_data['dashboard'].update({
  "patient_portal": "நியூரோஃப்ளெக்ஸ் நோயாளி தளம்",
  "hello": "வணக்கம், ",
  "assigned_clinician": "ஒதுக்கப்பட்ட மருத்துவர்:",
  "start_session": "பயிற்சியைத் தொடங்கு",
  "start_session_now": "இப்போதே தொடங்கு",
  "welcome_new": "வரவேற்கிறோம்! நீங்கள் இன்னும் உங்கள் முதல் மறுவாழ்வு அமர்வை முடிக்கவில்லை."
})

if 'navbar' not in ta_data:
    ta_data['navbar'] = {}
ta_data['navbar'].update({
  "platform": "பக்கவாத மீட்பு தளம்",
  "text_size": "உரை அளவு:",
  "sign_out": "வெளியேறு",
  "sign_in": "உள்நுழைக",
  "get_started": "தொடங்கு",
  "patient": "நோயாளி",
  "clinician": "மருத்துவர்"
})

with open(ta_path, 'w', encoding='utf-8') as f:
    json.dump(ta_data, f, indent=2, ensure_ascii=False)


hi_path = locales_dir / 'hi.json'
with open(hi_path, 'r', encoding='utf-8') as f:
    hi_data = json.load(f)

if 'dashboard' not in hi_data:
    hi_data['dashboard'] = {}
hi_data['dashboard'].update({
  "patient_portal": "न्यूरोफ्लेक्स मरीज पोर्टल",
  "hello": "नमस्ते, ",
  "assigned_clinician": "सौंपा गया डॉक्टर:",
  "start_session": "व्यायाम शुरू करें",
  "start_session_now": "अभी शुरू करें",
  "welcome_new": "स्वागत है! आपने अभी तक अपना पहला रिहैब सत्र पूरा नहीं किया है।"
})

if 'navbar' not in hi_data:
    hi_data['navbar'] = {}
hi_data['navbar'].update({
  "platform": "स्ट्रोक रिकवरी प्लेटफार्म",
  "text_size": "टेक्स्ट का आकार:",
  "sign_out": "साइन आउट",
  "sign_in": "साइन इन",
  "get_started": "शुरू करें",
  "patient": "मरीज",
  "clinician": "क्लिनिशियन"
})

with open(hi_path, 'w', encoding='utf-8') as f:
    json.dump(hi_data, f, indent=2, ensure_ascii=False)

print('Locales updated for demo.')
