import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	// Add support for adventure theme selector
	future: {
		hoverOnlyWhenSupported: true,
	},
	content: [
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: {
				DEFAULT: '1rem',
				sm: '1.5rem',
				lg: '2rem'
			},
			screens: {
				'2xl': '1400px'
			}
		},
		screens: {
			'xs': '375px',
			'sm': '640px',
			'md': '768px',
			'lg': '1024px',
			'xl': '1280px',
			'2xl': '1536px',
		},
		extend: {
			spacing: {
				'nav-safe': '4rem',
				'nav-safe-inset': 'calc(4rem + env(safe-area-inset-bottom, 0px))',
				'header-safe': 'calc(4rem + env(safe-area-inset-top, 0px))',
				'mobile-header': 'calc(4rem + env(safe-area-inset-top, 0px))',
				'safe-top': 'env(safe-area-inset-top, 0px)',
				'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
				'safe-left': 'env(safe-area-inset-left, 0px)',
				'safe-right': 'env(safe-area-inset-right, 0px)',
			},
			height: {
				'mobile-map': 'calc(100dvh - 8rem)',
				'mobile-content': 'calc(100dvh - 8rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
				'mobile-page': 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
				'mobile-scroll': 'calc(100dvh - 8rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
				'mobile-fit': 'calc(100dvh - 8rem)',
				'dvh': '100dvh',
			},
			maxHeight: {
				'mobile-fit': 'calc(100dvh - 8rem)',
				'mobile-content': 'calc(100dvh - 8rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				},
			fontFamily: {
				'pirata': ['Pirata One', 'cursive'],
				'adventure': ['Pirata One', 'cursive'],
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'expand-line': {
					'0%': {
						transform: 'scaleX(0)'
					},
					'100%': {
						transform: 'scaleX(1)'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'slide-up': {
					'0%': {
						opacity: '0',
						transform: 'translateY(20px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'expand-line': 'expand-line 0.8s ease-out 0.5s forwards',
				'fade-in': 'fade-in 0.6s ease-out',
				'slide-up': 'slide-up 0.6s ease-out',
				'slide-up-delay': 'slide-up 0.6s ease-out 0.2s both',
				'slide-up-delay-2': 'slide-up 0.6s ease-out 0.4s both',
			}
		}
	},
	plugins: [
		tailwindcssAnimate,
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		require('@tailwindcss/typography'),
		// Add adventure theme selector support
		function({ addVariant }: any) {
			addVariant('adventure', '.adventure &')
		},
		// Add safe area utilities
		function({ addUtilities }: any) {
			addUtilities({
				'.pt-safe-top': {
					'padding-top': 'env(safe-area-inset-top, 0px)'
				},
				'.pb-safe-bottom': {
					'padding-bottom': 'env(safe-area-inset-bottom, 0px)'
				},
				'.pl-safe-left': {
					'padding-left': 'env(safe-area-inset-left, 0px)'
				},
				'.pr-safe-right': {
					'padding-right': 'env(safe-area-inset-right, 0px)'
				},
				'.mt-safe-top': {
					'margin-top': 'env(safe-area-inset-top, 0px)'
				},
				'.mb-safe-bottom': {
					'margin-bottom': 'env(safe-area-inset-bottom, 0px)'
				},
				'.ml-safe-left': {
					'margin-left': 'env(safe-area-inset-left, 0px)'
				},
				'.mr-safe-right': {
					'margin-right': 'env(safe-area-inset-right, 0px)'
				}
			})
		}
	],
} satisfies Config;
