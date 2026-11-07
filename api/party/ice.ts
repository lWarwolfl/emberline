import type { IncomingMessage, ServerResponse } from "node:http";
import { handlePartyIceRequest } from "../../server/party-ice";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  handlePartyIceRequest(req, res);
}
