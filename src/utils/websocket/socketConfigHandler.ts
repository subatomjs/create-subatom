import path from "node:path";
import fs from "fs-extra";
import { ProjectConfig } from "../../types.js";
import socketFileContent from "./constant/socket-file-content.js";

async function socketConfigHandler(
  targetDir: string,
  language: ProjectConfig["language"],
) {
  const socket_directory = path.join(targetDir, "src", "web-socket");

  await fs.outputFile(
    path.join(socket_directory, `socket.${language}`),
    socketFileContent(language),
    "utf-8",
  );
}

export default socketConfigHandler;
