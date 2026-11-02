import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAccountRequest } from "../../server/accounts";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleAccountRequest(req, res);
}
