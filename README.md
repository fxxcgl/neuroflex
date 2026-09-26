# NeuroFlex Tele-Rehabilitation 

NeuroFlex is an advanced, AI-powered tele-rehabilitation platform designed for patients recovering from post-stroke motor deficits, orthopedic surgeries, sports injuries, and other mobility conditions. By leveraging on-device computer vision and decentralized/fiat payments, it enables patients to perform prescribed physical therapy exercises from home while clinicians remotely monitor their kinematics and adherence in real-time.

## Key Features

### For Patients
- **AI Movement Tracking (14 Exercises, 3 Modes):** Uses your device's webcam and MediaPipe Pose AI to track joint angles, count reps, and ensure proper form.
  - **Angle Rep Mode:** Tracks bidirectional joint flexion/extension (e.g., Knee Extensions, Heel Slides).
  - **Trajectory Mode:** Tracks spatial pathways and sway (e.g., Ankle Circles, Balance Holds, Gait Training).
  - **Timer/Hold Mode:** Guided isometric holds with self-reported completion.
- **Multilingual Voice Coaching:** Native, localized voice guidance in English, Hindi, Tamil, Bengali, and Telugu (`i18next` + Web Speech API).
- **Gamified Dashboard:** View real-time adherence rates, range-of-motion (ROM) progress charts, and daily exercise prescriptions.
- **Secure Payments (Fiat & Web3):** Unlock premium AI movement analysis reports using fiat (Stripe, Razorpay, PayPal) or Web3 payment gates (Ethereum via Wagmi, Algorand).
- **Telehealth & Messaging:** Book video appointments (Jitsi) and securely chat 1-on-1 with your assigned Physical Therapist.

### For Clinicians
- **Real-Time Caseload Monitoring:** View a comprehensive list of assigned patients, their compliance rates, and automated risk alerts.
- **Kinematic Telemetry:** Dive deep into session data to see peak extension angles, stability scores, compensation flags, and a rep-by-rep breakdown.
- **Prescription Management:** Remotely prescribe multi-exercise protocols tailored to the patient's specific injury (e.g., Post-Surgery Knee Protocol, Ankle Injury Protocol).
- **Integrated Scheduling:** Manage telehealth appointments directly from the dashboard.

## Technology Stack

### Core Frontend
- **Framework:** React 19, TypeScript 6, Vite 8
- **Routing:** React Router v7
- **Styling:** Tailwind CSS v4, Lucide React (icons)
- **State Management & Fetching:** TanStack React Query

### Backend, AI & Telehealth
- **Backend & Database:** Supabase (PostgreSQL, Row-Level Security, Authentication)
- **Computer Vision:** MediaPipe Tasks Vision (Pose Tracking)
- **Video Calling:** Jitsi React SDK
- **Data Visualization:** Recharts

### Payments & Web3
- **Decentralized Protocol:** x402 (`@x402/core`, `@x402/fetch`)
- **EVM Blockchain:** Wagmi, Viem, RainbowKit
- **Algorand Blockchain:** Pera Wallet Connect, Algorand SDK
- **Fiat Providers:** Stripe, Razorpay, PayPal Checkout

## Getting Started (Local Development)

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm
- A Supabase Project

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/neuroflex.git
   cd neuroflex
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Copy the example environment file and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
   Ensure you add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

4. **Run the local development server:**
   ```bash
   npm run dev
   ```
   The app will be running at `http://localhost:5173`.

## Database Setup (Supabase)
To enable full functionality (Authentication, Telemetry, Messaging), you must apply the SQL migrations located in the `supabase/migrations/` folder. 

These migrations establish the tables (`prescriptions`, `session_reps`, `patient_profiles`, etc.) and enforce strict Row-Level Security (RLS) policies to ensure HIPAA-like data isolation.

---
*Built with modern web technologies to make clinical rehabilitation accessible, engaging, and objectively measurable.*
