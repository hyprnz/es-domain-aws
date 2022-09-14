module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["./**/?(*.)+(integration|micro).ts"],
  roots: ["./src"],
  testPathIgnorePatterns: ["node_modules", ".devcontainer", "dist"],
  watchPathIgnorePatterns: ["node_modules", ".devcontainer", "dist"],
  // setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
}
