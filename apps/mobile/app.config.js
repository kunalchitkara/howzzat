const appJson = require("./app.json");

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      apiUrl:
        process.env.EXPO_PUBLIC_API_URL ?? appJson.expo.extra.apiUrl,
    },
  },
};
