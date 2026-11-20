import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#050505',
        panel: '#0A0F14',
        electric: '#38bdf8',
        network: '#22c55e',
        lime: '#84cc16',
        signal: '#f97316',
        yellow: '#eab308',
      },
    },
  },
  plugins: [],
};

export default config;
