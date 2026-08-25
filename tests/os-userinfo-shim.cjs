/* eslint-disable @typescript-eslint/no-require-imports */
const os = require("node:os");
const { syncBuiltinESMExports } = require("node:module");

try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: process.env.USERNAME || "test-user",
    homedir: process.env.USERPROFILE || process.cwd(),
    shell: null,
  });
  syncBuiltinESMExports();
}
