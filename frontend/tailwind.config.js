/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf9',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#0d9488', // Calming Teal (Primary)
          600: '#0f766e',
          700: '#115e59',
          800: '#134e4a',
          900: '#042f2e',
        },
        slate: {
          850: '#151e2e',
          900: '#0f172a',
          950: '#090d16',
        },
        accent: {
          patient: '#0284c7', // Sky blue for patient
          patientHover: '#0369a1',
          clinician: '#059669', // Emerald green for clinician
          clinicianHover: '#047857',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      minHeight: {
        'touch': '44px',
        'touch-lg': '52px',
      },
      minWidth: {
        'touch': '44px',
        'touch-lg': '52px',
      }
    },
  },
  plugins: [],
}
