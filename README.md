# Connectivity Status App

A cross-platform mobile app built with **React Native** and **Expo** that detects the device's network connectivity, shows whether it is online or offline, identifies the connection type, and updates automatically whenever the connection changes.

Built as part of a lab experiment: *Develop a Connectivity-Based Cross-Platform Application Using React Native*.

## Features

### Core features
- Large status indicator: green when online, red when offline
- Connection type label: Wi-Fi, Cellular, Ethernet or No Connection
- Internet reachability check, separate from the network link
- Reads the initial network state when the app loads
- Subscribes to live connectivity changes and updates the UI automatically
- Cleans up the listener when the screen closes
- Manual Refresh button
- Vibration and pulse animation when the state flips between online and offline

### Enhancements
- Offline banner at the top of the screen
- Last checked timestamp
- Connection history log (last 10 changes)
- Dark mode, following the phone's theme
- Cellular generation display, for example "Cellular (4G)"
- Wi-Fi details: network name, IP address, signal strength and frequency
- Latency test: measures the time to reach the internet in ms
- Offline message queue: messages sent while offline are queued and marked as sent when the connection returns (the sync is simulated)
- Cached data: a quote is fetched online and saved locally, then shown from the cache when offline

## Tech Stack

- [React Native](https://reactnative.dev/)
- [Expo](https://expo.dev/) (SDK 57)
- [@react-native-community/netinfo](https://github.com/react-native-netinfo/react-native-netinfo)
- [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage)

## Prerequisites

- Node.js LTS (v22 or v24). Odd-numbered versions such as v23 are not supported by current Expo packages.
- npm
- A phone with the **Expo Go** app installed, or an Android emulator / iOS simulator
- A free [Expo account](https://expo.dev/), needed to sign in to Expo Go on iOS

## Installation

```bash
git clone https://github.com/YOUR-USERNAME/ConnectivityApp.git
cd ConnectivityApp
npm install
```

If the dependencies need to be added manually:

```bash
npx expo install @react-native-community/netinfo
npx expo install @react-native-async-storage/async-storage
```

## Running the App

```bash
npx expo start -c
```

1. Sign in to the same Expo account in the terminal (`npx expo login`) and in the Expo Go app.
2. Make sure the phone and laptop are on the same Wi-Fi network.
3. Scan the QR code with Expo Go (Android) or the Camera app (iPhone).

If the phone cannot connect, try tunnel mode:

```bash
npx expo start --tunnel
```

> **Note:** The Expo SDK of this project must match the SDK supported by the Expo Go version on your phone. If you see "Project is incompatible with this version of Expo Go", recreate the project with a matching SDK template, for example `--template blank@sdk-57`.

## How to Test

| Test | Expected result |
|---|---|
| Open the app on Wi-Fi | Green circle, "Wi-Fi", "Internet reachable: Yes" |
| Turn on Airplane Mode | Red circle, "No Connection", offline banner, phone vibrates |
| Turn Airplane Mode off | Green circle returns, history log updates |
| Turn Wi-Fi off with mobile data on | Label changes to "Cellular" |
| Press Refresh | Status and latency are re-checked |
| Send messages while offline | Messages show as Queued, then flip to Sent after reconnecting |
| Open the app online, then go offline | The cached quote is shown, labelled as cached |

## How It Works

```
App loads
  ├── NetInfo.fetch()            -> read the initial state
  ├── NetInfo.addEventListener() -> receive live changes
  └── useEffect cleanup          -> unsubscribe on unmount

useState holds { type, isConnected, isInternetReachable, details }
Every state change re-renders the indicator, labels and cards.
```

## Project Structure

```
ConnectivityApp/
├── App.js          # All app logic and UI
├── app.json        # Expo configuration
├── index.js        # Entry point
├── package.json    # Dependencies and scripts
└── assets/         # Icons and splash images
```

## Limitations

- On iOS, some Wi-Fi details (such as the network name) are hidden by the OS.
- The message queue sync is simulated. There is no real backend.
- The quote needs internet at least once before it can be cached.

## Author

Your Name  
VJTI | CROSS PLATFORM APP DEVELOPMENT | SHIPRA SINGH

## License

This project was created for educational purposes.
