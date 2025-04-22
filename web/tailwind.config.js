module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb', // blue
        sidebar: '#111827', // dark
        background: '#f3f4f6', // light
        success: '#10b981', // green
        danger: '#ef4444', // red
        textMain: '#111827',
        textSecondary: '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px 0 rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
