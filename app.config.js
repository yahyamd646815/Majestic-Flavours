const fs = require("fs");
const path = require("path");

const IS_DEV = process.env.APP_VARIANT === "development";

// Android push tokens come from Firebase Cloud Messaging. Without
// `google-services.json` in the build, `getExpoPushTokenAsync` throws
// "Unable to get Firebase Messaging instance" before it ever reaches Expo's
// servers, so no token is ever stored — while local reminders keep working
// normally, since those need no Firebase at all. That asymmetry is what made
// this look like a client bug rather than a missing credential.
//
// Pointed at a file that is not there, prebuild fails outright, so it is only
// wired up when the file actually exists — and its absence is said out loud
// in the build log instead of being discovered on a device weeks later.
// `GOOGLE_SERVICES_JSON` follows EAS's file-secret convention: EAS writes the
// secret to a temporary file and puts that path in the variable.
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";
const hasGoogleServicesFile = fs.existsSync(path.resolve(__dirname, googleServicesFile));

if (!hasGoogleServicesFile) {
  console.warn(
    `[app.config] No google-services.json at "${googleServicesFile}" — this build cannot register Android push tokens, so app_users.expo_push_token will stay null and task-assignment pushes will not send. Local reminders are unaffected. Setup: https://docs.expo.dev/push-notifications/fcm-credentials/`,
  );
}

module.exports = {
  expo: {
    name: IS_DEV ? "Majestic Flavours (Dev)" : "Majestic_Flavours",
    slug: "Majestic_Flavours",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "majesticflavours",
    userInterfaceStyle: "automatic",
    android: {
      ...(hasGoogleServicesFile ? { googleServicesFile } : {}),
      adaptiveIcon: {
        backgroundColor: "#F8EDD5",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      package: IS_DEV
        ? "com.yahyamd6468.Majestic_Flavours.dev"
        : "com.yahyamd6468.Majestic_Flavours",
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#F8EDD5",
          android: { image: "./assets/images/splash-icon.png", imageWidth: 180 },
        },
      ],
      [
        "expo-font",
        {
          fonts: [
            "./assets/fonts/Inter-Regular.ttf",
            "./assets/fonts/Inter-Medium.ttf",
            "./assets/fonts/Inter-SemiBold.ttf",
            "./assets/fonts/Inter-Bold.ttf",
          ],
        },
      ],
      "@clerk/expo",
      "expo-secure-store",
      "expo-sharing",
      "expo-file-system",
      "expo-localization",
      "expo-updates",
      [
        "expo-notifications",
        {
          // Android renders the status-bar icon as a flat silhouette, which is
          // exactly what the adaptive monochrome icon already is — no separate
          // asset needed. `color` tints it in the tray (brand gold).
          icon: "./assets/images/android-icon-monochrome.png",
          color: "#C8A44A",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    updates: {
      url: "https://u.expo.dev/23fd4d8b-a07c-429b-880c-9f90d56e86b8",
    },
    runtimeVersion: {
      policy: "fingerprint",
    },
    extra: {
      router: {},
      eas: { projectId: "23fd4d8b-a07c-429b-880c-9f90d56e86b8" },
    },
  },
};