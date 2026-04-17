module.exports = {
  rootDir: __dirname,
  testEnvironment: "jsdom",
  testMatch: [
    "<rootDir>/src/**/*.test.jsx",
  ],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp)$": "<rootDir>/test/fileMock.js",
  },
  setupFilesAfterEnv: [
    "<rootDir>/test/jest.setup.js",
  ],
};
