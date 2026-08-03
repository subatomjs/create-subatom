import path from "path"
import {Subatom, json, urlencoded, serveStatic} from 'subatom'

const server = new Subatom()

server.use(json({ limit: "500mb" }));
server.use(urlencoded({ limit: "50mb" }));

server.use(serveStatic(path.join(process.cwd(), "public")));

export default server
