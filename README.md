# Treasures.to

Treasures.to is a decentralized geocaching platform built on the Nostr protocol. Discover hidden geocaches, share locations, and connect with explorers worldwide through a censorship-resistant, open network.

## Join the adventure now at [treasures.to](https://treasures.to)!

![Treasures.to](./public/og-image.png)

## 💎 Features

- **🗺️ Interactive Map**: Explore geocaches on a detailed map with custom markers and search.
- **✍️ Log Adventures**: Record your finds, DNFs (Did Not Find), and notes about each cache.
- **📲 QR Code Verification**: A novel QR code verification system for cache finds with cryptographic proof.
- **🔗 Compact QR URLs**: Shorter URL format (`/c/...`) for smaller, easier-to-print QR codes (25% reduction).
- **Nostr**: Built on the decentralized Nostr network for a censorship-resistant experience.
- **🧑‍💻 Open Source**: This project is licensed under the GNU Affero General Public License v3.0.
- **🚫 No Registration**: Login with any Nostr keypair - no email or personal data required.
- **📍 Location Search**: Find geocaches by city, zip code, or "Near Me" functionality.
- **⚡ Zaps**: Users can send Bitcoin lightning zaps to geocache creators and finders.
- **📴 Offline Support**: Full PWA support - app works offline even if the server is down.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://gitlab.com/chad.curtis/treasures.git
    cd treasures
    ```
2.  **Install dependencies**
    ```bash
    npm install
    ```
3.  **Start development server**
    ```bash
    npm run dev
    ```
4.  **Open your browser**
    Navigate to `http://localhost:8080`

### Building for Production

```bash
npm run build
npm run preview
```

## 💻 Technology Stack

- **React 18**: Modern React with hooks and concurrent rendering.
- **TypeScript**: Type-safe JavaScript development.
- **Vite**: Fast build tool and development server.
- **TailwindCSS 3**: Utility-first CSS framework.
- **shadcn/ui**: Unstyled, accessible UI components built with Radix UI.
- **@nostrify/react**: React hooks and components for Nostr.
- **TanStack Query**: Powerful data fetching, caching, and synchronization.
- **Leaflet**: Open-source interactive maps.

## 🔗 Compact QR Code URLs

Shorter URL format for QR codes (48% reduction): `http://treasures.to/c/{base64url-payload}`

**Payload structure (70 bytes):**
```
[0-31]  pubkey (32 bytes)
[32-37] d-tag (6 bytes, hex string)
[38-69] verification private key (32 bytes)
```

Decode with base64url, then use standard Nostr tools (`nip19.naddrEncode`, `nip19.nsecEncode`). Kind is always `37516`.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
