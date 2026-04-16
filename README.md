# FungiDex

FungiDex is an Expo Router app for learning, logging, and comparing mushrooms with one shared React Native codebase for Android and iPhone.

## Fastest Sharing Path

The supported no-fee cross-platform sharing path is Expo Go.

1. Install `Expo Go` on the phone.
2. In this project, run `npm run start:tunnel`.
3. Wait for the QR code to appear in the Expo terminal.
4. Have your friend scan the QR code with their phone camera or Expo Go scanner.
5. Grant camera or photo-library permissions when FungiDex asks for them.

`--tunnel` is the default recommendation because it works better when your friends are not on the same Wi-Fi network.

## Host Requirements

- Keep your PC on while others are using the app.
- Leave the Expo dev server running.
- Restart the Expo server after changing dependencies or app config:

```bash
npm run start:tunnel
```

If someone is on the same network and tunnel is slow, you can still use:

```bash
npm start
```

## Notes

- iPhone support is optimized for Expo Go, not standalone App Store/TestFlight distribution.
- Android can still be packaged for direct install later without splitting the codebase.
