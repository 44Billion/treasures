# 🗺️ NostrCache

A decentralized geocaching platform built on the Nostr protocol. Discover hidden treasures, share locations, and connect with explorers worldwide through a censorship-resistant, open network.

![NostrCache Demo](./public/og-image.png)

## ✨ Features

### 🏃‍♂️ Core Geocaching
- **Hide Geocaches**: Create and publish geocaches with GPS coordinates, descriptions, and difficulty ratings
- **Find Treasures**: Discover geocaches hidden by other users around the world
- **Interactive Map**: Explore locations on a detailed map with custom markers and search functionality
- **Log Adventures**: Record your finds, DNFs (Did Not Find), and notes about each cache

### 🌍 Decentralized & Open
- **Nostr Protocol**: Built on the decentralized Nostr network - no central authority
- **Censorship Resistant**: Your geocaches and logs are stored across multiple relays
- **Open Source**: Fully open-source codebase with MIT license
- **No Registration**: Login with any Nostr keypair - no email or personal data required

### 🎯 Advanced Features
- **Location Search**: Find geocaches by city, zip code, or "Near Me" functionality
- **Smart Filtering**: Filter by difficulty, terrain, cache type, and size
- **Distance Sorting**: Automatically sort results by proximity to your location
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Progressive Web App**: Install as a native app on mobile devices
- **Image Support**: Upload and view images for geocaches
- **Real-time Updates**: Automatic syncing across the Nostr network

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/nostrcache.git
   cd nostrcache
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview
```

## 🏗️ Technology Stack

### Frontend Framework
- **React 18** - Modern React with hooks and concurrent rendering
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server

### Styling & UI
- **TailwindCSS 3** - Utility-first CSS framework
- **shadcn/ui** - Unstyled, accessible UI components built with Radix UI
- **Lucide React** - Beautiful, customizable icons

### Nostr Integration
- **@nostrify/nostrify** - Nostr protocol framework for web
- **@nostrify/react** - React hooks and components for Nostr

### Data & State Management
- **TanStack Query** - Powerful data fetching, caching, and synchronization
- **React Router** - Declarative client-side routing

### Maps & Location
- **Leaflet** - Open-source interactive maps
- **React Leaflet** - React components for Leaflet maps

## 🗂️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── auth/           # Authentication components
│   ├── GeocacheMap.tsx # Interactive map component
│   └── GeocacheList.tsx # Cache listing component
├── hooks/              # Custom React hooks
│   ├── useNostr.ts     # Nostr protocol integration
│   ├── useGeocaches.ts # Geocache data fetching
│   └── useCurrentUser.ts # User authentication
├── pages/              # Route components
│   ├── Home.tsx        # Landing page
│   ├── Map.tsx         # Main map interface
│   ├── CreateCache.tsx # Create new geocache
│   └── CacheDetail.tsx # Individual cache view
├── lib/                # Utility functions
│   ├── geo.ts          # Geographic calculations
│   └── date.ts         # Date formatting
└── types/              # TypeScript type definitions
```

## 🎮 How to Use

### Getting Started
1. **Open NostrCache** in your web browser
2. **Connect your Nostr account** using any NIP-07 compatible browser extension (like Alby, nos2x, or Flamingo)
3. **Explore the map** to find geocaches near you or search by location

### Finding Geocaches
- Use the **search bar** to find caches by name or location
- Click **"Near Me"** to find caches around your current location  
- **Filter results** by difficulty (D1-D5) and terrain (T1-T5)
- **Adjust search radius** from 5km to 100km
- Click on **map markers** or **list items** to view cache details

### Hiding Geocaches
1. Click **"Hide a Cache"** or the **+** icon in navigation
2. Fill out cache details: name, description, difficulty, terrain
3. **Click on the map** to set GPS coordinates
4. Add optional **hint** and **images**
5. **Publish** your cache to the Nostr network

### Logging Finds
- Open any geocache detail page
- Choose log type: **Found It**, **Didn't Find It**, or **Write Note**
- Share your experience in the log text
- **Post your log** to help other cachers

## 🔗 Nostr Integration

NostrCache leverages the Nostr protocol for decentralized data storage:

### Event Types
- **Kind 1**: Geocache creation and log entries
- **Kind 0**: User profile metadata
- **Kind 3**: Following relationships (for social features)

### Relays
The app connects to multiple Nostr relays for redundancy:
- `wss://ditto.pub/relay`
- `wss://relay.damus.io`
- `wss://nos.lol`

### Data Format
Geocaches are stored as Nostr events with custom tags for location, difficulty, terrain, and other metadata. All data is cryptographically signed and verifiable.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and test thoroughly
4. Commit with descriptive messages (`git commit -m 'Add amazing feature'`)
5. Push to your branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Running Tests
```bash
npm run test        # Run all tests
npm run lint        # Check code formatting
npm run type-check  # TypeScript type checking
```

## 📱 Progressive Web App

NostrCache works as a Progressive Web App (PWA):

- **Offline Support**: Cache data for offline viewing
- **Install Prompt**: Add to home screen on mobile devices
- **Push Notifications**: Get notified about new caches (coming soon)
- **Background Sync**: Sync data when connection is restored

## 🛣️ Roadmap

### v1.0 - Core Features ✅
- [x] Basic geocache creation and discovery
- [x] Interactive map interface
- [x] Location search and filtering
- [x] User authentication via Nostr
- [x] Mobile-responsive design

### v1.1 - Enhanced Experience 🚧
- [ ] Offline support and caching
- [ ] Push notifications for new nearby caches
- [ ] Social features (following other cachers)
- [ ] Cache series and challenges
- [ ] Advanced stats and leaderboards

### v1.2 - Community Features 📋
- [ ] Cache reviews and ratings
- [ ] Photo sharing and galleries
- [ ] Event coordination (cache meetups)
- [ ] Multi-language support
- [ ] Cache maintenance tools

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Nostr Protocol** - For providing the decentralized foundation
- **OpenStreetMap** - For high-quality, open map data
- **React Community** - For the amazing ecosystem and tools
- **Geocaching Community** - For inspiring this adventure platform

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/nostrcache/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/nostrcache/discussions)
- **Nostr**: Follow updates at `npub1...` (coming soon)

---

**Start your adventure today!** 🗺️✨ Hide caches, find treasures, and explore the world through NostrCache.