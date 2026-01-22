import fs from "node:fs";
import openapiTS, { astToString } from "openapi-typescript";

const ITSROSE_OPENAPI_URL = "https://api.itsrose.net/openapi.json";

const ast = await openapiTS(ITSROSE_OPENAPI_URL);
const contents = astToString(ast);

// (optional) write to file
fs.writeFileSync("./src/types/itsrose-schema.ts", contents);
