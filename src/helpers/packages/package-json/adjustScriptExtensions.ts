import type { ProjectConfig } from "../../../types.js";

function adjustScriptExtensions(
  scripts: Record<string, string>,
  language: ProjectConfig["language"],
): Record<string, string> {
  if (language !== "js" && language !== "ts") return scripts;

  const targetExt = language === "js" ? ".js" : ".ts";
  const sourcePattern = language === "js" ? /\.ts\b/g : /\.js\b/g;

  const updatedScripts: Record<string, string> = {};
  for (const [key, value] of Object.entries(scripts)) {
    updatedScripts[key] = value.replace(sourcePattern, targetExt);
  }
  return updatedScripts;
}

export default adjustScriptExtensions