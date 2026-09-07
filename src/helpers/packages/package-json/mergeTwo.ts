import type { PackageJsonShape } from "./mergePackageJson.js";

function mergeTwo(
  base: PackageJsonShape,
  incoming: PackageJsonShape,
): PackageJsonShape {
  return {
    ...base,
    ...incoming,
    scripts: { ...base.scripts, ...incoming.scripts },
    dependencies: { ...base.dependencies, ...incoming.dependencies },
    devDependencies: { ...base.devDependencies, ...incoming.devDependencies },
  };
}

export default mergeTwo