const fs = require("fs");
const path = require("path");

// React Native 0.83's generated Android build expects hermesc inside the
// react-native package, while npm installs the compiler as a sibling package.
// Restore the expected link after every install so local and EAS release
// builds use the SDK-matched compiler without patching generated native files.
const reactNativeDir = path.dirname(require.resolve("react-native/package.json"));
const compilerDir = path.dirname(require.resolve("hermes-compiler/package.json"));
const source = path.join(compilerDir, "hermesc");
const target = path.join(reactNativeDir, "sdks", "hermesc");

if (!fs.existsSync(target)) {
  const relativeSource = path.relative(path.dirname(target), source);
  fs.symlinkSync(relativeSource, target, process.platform === "win32" ? "junction" : "dir");
  console.log("Linked React Native to the installed Hermes compiler.");
}
