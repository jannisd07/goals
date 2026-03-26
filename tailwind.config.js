/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit_400Regular"],
        medium: ["Outfit_500Medium"],
        semibold: ["Outfit_600SemiBold"],
        bold: ["Outfit_700Bold"],
      },
      colors: {
        background: "#0A0A0F",
        surface: "rgba(255, 255, 255, 0.06)",
        "surface-border": "rgba(255, 255, 255, 0.10)",
        "text-primary": "#FFFFFF",
        "text-secondary": "rgba(255, 255, 255, 0.70)",
        "text-tertiary": "rgba(255, 255, 255, 0.40)",
        accent: {
          blue: "#4A9EFF",
          purple: "#A855F7",
          green: "#34D399",
          orange: "#FB923C",
          pink: "#F472B6",
          cyan: "#22D3EE",
          red: "#EF4444",
          yellow: "#FACC15",
        },
      },
      borderRadius: {
        card: "20px",
        button: "14px",
      },
      fontSize: {
        "balance": ["48px", { lineHeight: "56px", fontWeight: "700", fontFamily: "Outfit_700Bold" }],
        "heading": ["24px", { lineHeight: "32px", fontWeight: "600", fontFamily: "Outfit_600SemiBold" }],
        "subheading": ["18px", { lineHeight: "24px", fontWeight: "600", fontFamily: "Outfit_600SemiBold" }],
        "body": ["16px", { lineHeight: "22px", fontWeight: "400", fontFamily: "Outfit_400Regular" }],
        "caption": ["13px", { lineHeight: "18px", fontWeight: "400", fontFamily: "Outfit_400Regular" }],
        "tiny": ["11px", { lineHeight: "14px", fontWeight: "500", fontFamily: "Outfit_500Medium" }],
      },
      spacing: {
        "screen-x": "20px",
        "card-padding": "16px",
      },
    },
  },
  plugins: [],
};
