const IS_DEV = process.env.APP_VARIANT === "development";

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