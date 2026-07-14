Read AGENTS.md first and follow it strictly.

Implement the full design system for the Majestic Flavors restaurant inventory app using NativeWind. Set up global CSS utilities in global.css, define design tokens in a theme folder, and configure font loading.

The restaurant brand is Majestic Flavors — an authentic Pakistani restaurant based in Riyadh, Saudi Arabia. The brand uses a regal gold and deep maroon color scheme with a crown motif. The app should feel premium, clean, and professional while reflecting this brand identity.

Use these exact brand color tokens:

Primary gold (brand accent, buttons, active states): #C8A44A
Deep maroon (header backgrounds, role badges, brand text): #7B1515
Dark green background (for headers or nav): #1B3A2D
Cream surface (card backgrounds, subtle section backgrounds): #F8EDD5
White (main background, card surfaces): #FFFFFF
Text primary (main body text): #1A1A1A
Text secondary (labels, subtitles): #6B6B6B
Border (card borders, dividers): #E8E0D0

Status colors (do not change these — they are for stock indicators):
- In stock: #16a34a (green-600)
- Low stock: #d97706 (amber-600)
- Out of stock: #dc2626 (red-600)

Typography:
Use the Inter font via expo-font for all body text. Use a serif or display font for the app name header if available, otherwise fall back to Inter bold.

Global utilities to create in global.css:
- .card — white background, rounded-xl, soft shadow, padding
- .section-header — deep maroon background, white text, padding
- .badge-gold — gold background, dark text, rounded-full, small padding
- .badge-maroon — maroon background, white text, rounded-full, small padding
- .status-badge — base badge style extended by color variants
- .btn-primary — gold background, dark text, rounded-lg, full width
- .btn-danger — red background, white text, rounded-lg

The app logo is the Majestic Flavors MF crown emblem. Place it in assets/images/ and register it in constants/images.ts as images.logo.

Ensure all tokens are consistent and accessible as NativeWind utilities across all future screens.
